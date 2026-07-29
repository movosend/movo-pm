# movo-pulse · Pre-plan y dominio del problema

> Documento de entrada para Claude Code. Describe el problema, las decisiones ya tomadas y los criterios de aceptación. No es una especificación de implementación cerrada: donde diga **decisión abierta**, hay que consultarlo con el equipo antes de avanzar.
>
> **Adjunto obligatorio:** `docs/mockup.html`. Es un boceto funcional completo (grafo, layout por niveles, panel lateral, bloque de decisiones) escrito en HTML plano con datos embebidos. La UI final debe partir de ahí, no reinventarse. El contrato de datos del boceto ya está validado contra datos reales de Linear y se reutiliza tal cual.

---

## 0 · Qué es esto

Una herramienta interna de un equipo de cinco desarrolladores que trabaja en Linear por ciclos de dos semanas. Sirve para **una sesión concreta: la planning**. El equipo se sienta, abre esto proyectado, y en cinco minutos ve qué frena a qué, qué no va a llegar y qué hay que decidir.

Se despliega en Vercel, en un repo aparte dentro de la organización `movosend`.

### Qué NO es

Explícito, porque cada uno de estos puntos es una tentación real durante la implementación:

- **No reemplaza a Linear.** Linear sigue siendo la fuente de verdad. Esto es una lente.
- **No escribe en Linear en la v1.** Solo lectura. Escribir (mover issues de ciclo, reasignar) es v2 y necesita una conversación aparte sobre permisos.
- **No es un PM automático.** Genera decisiones _propuestas_. Las toma el equipo.
- **No es un dashboard de métricas de productividad.** Nada de velocity por persona, nada de rankings. Es una herramienta de coordinación, no de evaluación. Esta restricción es de diseño y no se negocia.
- **No es multi-tenant.** Un workspace, un equipo, cinco usuarios. Cualquier abstracción para "soportar otras organizaciones" es esfuerzo tirado.

---

## 1 · Dominio del problema

### 1.1 Glosario

| Término                 | Definición operativa                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ciclo**               | Sprint de Linear. Tiene fecha de inicio y fin, y un conjunto de issues asignadas. Solo interesa el ciclo activo (`Team.activeCycle`).                                                                          |
| **Issue**               | Unidad de trabajo. Tiene identificador (`MOVO-66`), estado, estimación en puntos, responsable y opcionalmente un padre.                                                                                        |
| **Relación de bloqueo** | Arista dirigida A → B: A debe terminarse antes que B. En Linear es `IssueRelation` con `type: "blocks"`. Es simétrica en la API: aparece en `relations` de A y en `inverseRelations` de B. Hay que deduplicar. |
| **Sub-issue**           | Relación padre/hijo. **No es una dependencia** y no entra en el cálculo de niveles. Es jerarquía de alcance, no de orden.                                                                                      |
| **Nivel topológico**    | Profundidad de un nodo en el DAG de bloqueo. Nivel 0 = nada lo frena.                                                                                                                                          |
| **Cadena crítica**      | Camino más largo del DAG. Es el piso de tiempo del ciclo: no se acorta agregando gente.                                                                                                                        |
| **Bloqueo abierto**     | Arista A → B donde A todavía no está en un estado `completed`.                                                                                                                                                 |
| **Huérfano**            | Issue del ciclo que no participa en ninguna relación de bloqueo.                                                                                                                                               |
| **Sub-issue varado**    | Hijo de una issue del ciclo que quedó fuera del ciclo. Es el defecto más frecuente y más caro.                                                                                                                 |

### 1.2 Invariantes del dominio

Estas reglas son el núcleo. Si el código las viola, el reporte miente.

1. **El grafo de bloqueo debe ser un DAG.** Linear permite crear ciclos de dependencias. Si aparece uno, el sistema **no debe romperse ni entrar en recursión infinita**: debe detectarlo, mostrarlo como un error de datos en la UI con los identificadores involucrados, y seguir renderizando el resto. La detección de ciclos es un requisito, no un caso borde.

2. **Los estados se leen por `statusType`, no por nombre.** Linear permite renombrar estados por equipo. Los tipos son `completed`, `started`, `unstarted`, `ready_for_development`, `backlog`, `canceled`. El nombre se muestra; el tipo se usa para calcular. Nunca comparar contra el string `"Done"`.

3. **Un padre no puede cerrarse si sus hijos no cierran.** Si una issue del ciclo tiene hijos fuera del ciclo, ese padre está comprometido en el scope pero no es completable. El sistema debe detectarlo siempre.

4. **Las issues fuera del ciclo existen solo como contexto.** Aparecen porque están en una relación con algo del ciclo. No suman puntos, no cuentan para el progreso, se dibujan con borde punteado.

5. **La estimación puede ser nula.** Las user stories padre normalmente no tienen puntos porque los tienen sus hijos. Nunca asumir un número; propagar el `null` y mostrarlo como "sin estimar".

6. **El grafo solo ve lo declarado.** Si el equipo no cargó una relación en Linear, no existe para el sistema. Esta limitación debe estar visible en la UI, no escondida en un README. Un ciclo con muchos huérfanos es señal de disciplina floja, no de ausencia de dependencias.

### 1.3 Preguntas que el sistema debe contestar

En orden de importancia. Si una versión no contesta las primeras cuatro, no sirve.

1. ¿Qué está frenando a más cosas y todavía no arrancó?
2. ¿Cuál es la cadena más larga y entra en los días que quedan?
3. ¿Qué issues del ciclo tienen sub-issues afuera y por lo tanto no van a cerrar?
4. Si destrabo _una sola_ cosa hoy, ¿cuál libera más trabajo?
5. ¿Quién está sobre el camino crítico y con cuántos frentes abiertos?
6. ¿Qué cambió desde la planning anterior? ¿Qué bloqueo sobrevivió dos ciclos?

La sexta es la que justifica guardar histórico y la que más valor va a dar a mediano plazo.

---

## 2 · Decisiones de arquitectura

Cada una viene con su porqué. Si Claude Code encuentra un motivo fuerte para desviarse, que lo plantee antes de implementar.

### 2.1 Stack

**Next.js (App Router) + TypeScript + shad/cn, desplegado en Vercel.**

Motivo: el equipo ya usa exactamente ese stack en `movo-admin`. Consistencia sobre novedad. Server Components para la carga inicial, Route Handlers para la API interna.

### 2.2 Autenticación

**Decisión: Auth.js (NextAuth v5) con proveedor GitHub, restringido por pertenencia a la organización `movosend`, más una allowlist de correos en variable de entorno.**

Motivo: son cinco personas que ya tienen cuenta de GitHub en la organización. Es la fricción mínima que sigue siendo real. El `callbacks.signIn` rechaza cualquier cuenta fuera de la allowlist.

**Alternativa considerada y descartada por ahora: Linear OAuth.** Sería más elegante (la identidad viene de la misma fuente que los datos, y cada usuario consultaría Linear con sus propios permisos), pero exige registrar una app OAuth, manejar refresh de tokens y guardar tokens por usuario. Para cinco devs con los mismos permisos es sobreingeniería. **Es el camino de upgrade natural** si alguna vez esto sale del equipo, y conviene dejar la capa de acceso a Linear detrás de una interfaz para que el cambio sea local.

**Lo que no se hace:** contraseña compartida en una variable de entorno. Parece "básico y seguro" y no es ninguna de las dos.

### 2.3 Acceso a Linear

**Una API key personal de Linear guardada como variable de entorno en Vercel, usada exclusivamente desde el servidor.**

La key nunca llega al navegador. Toda consulta a Linear pasa por un Route Handler. Esto es no negociable: una key personal actúa como su dueño sobre todo el workspace.

Consecuencia a documentar: todos los usuarios ven lo mismo, porque todos consultan con la misma identidad. Para cinco devs del mismo equipo es correcto. Cuando deje de serlo, se migra a OAuth.

### 2.4 Persistencia - Evaluar si realmente es necesario persistir o es preferible una funcionalidad tipo snapshots/tiempo real

**Postgres serverless (Neon o Vercel Postgres) con Drizzle ORM.**

Motivo: hace falta guardar histórico de snapshots y de análisis para contestar la pregunta 6 de la sección 1.3. Con solo un caché key-value se pierde eso, que es justamente lo que más valor va a dar en la tercera planning.

No reutilizar la instancia de PostgreSQL de Movo en EC2. Acoplar una herramienta interna a la base del producto es una mala idea y además esa instancia ya es un punto único de falla documentado.

### 2.5 Sincronización con Linear

Este es el punto donde "tiempo real" necesita una traducción honesta.

**Decisión: webhook de Linear + revalidación de caché + polling de respaldo cada 60 segundos mientras la pestaña está visible.**

Por qué no WebSockets: mantener conexiones persistentes en funciones serverless de Vercel es caro y frágil, y no compra nada. La diferencia entre ver un cambio en 200 ms o en 30 segundos es irrelevante en una planning, donde el ritmo lo marca la conversación.

**Riesgo a verificar en el paso 1 de la implementación:** Linear documenta webhooks de cambio de datos para issues, comentarios, etiquetas, proyectos y ciclos, pero **no está confirmado que emita eventos para `IssueRelation`**. Si no lo hace, un cambio de dependencia no dispararía webhook y el polling deja de ser respaldo para pasar a ser el mecanismo principal. Hay que verificarlo contra la API real antes de diseñar alrededor de los webhooks. Si se confirma que no hay eventos de relación, el diseño correcto es: polling cada 60 s con ETag/hash del snapshot para no reprocesar cuando no cambió nada.

**Verificación de firma HMAC obligatoria** en el endpoint de webhook. Un endpoint público que dispara resincronización es un vector de denegación de servicio trivial.

### 2.6 Integración con Claude

**La pared entre cálculo y redacción es la decisión de arquitectura más importante del proyecto.**

- **Todas las métricas se calculan en TypeScript**, en funciones puras y testeadas: niveles, cadena crítica, cuellos de botella, bloqueos abiertos, hijos varados, carga por persona. El modelo no cuenta, no suma, no infiere dependencias.
- **El modelo recibe las métricas ya calculadas** más una versión resumida de las issues (identificador, título, estado, responsable, puntos, relaciones). **No recibe las descripciones completas**: son largas, tienen criterios de aceptación y detalle técnico que no aportan al análisis y multiplican el costo. Excepción: buscar menciones de dependencias externas (credenciales, sandbox, proveedores) requiere leer descripciones, así que se hace una pasada de extracción por palabras clave en código y se le pasa solo el resultado.
- **El modelo devuelve JSON estructurado**, validado con Zod contra el esquema de la sección 5.2. Si no valida, se reintenta una vez y después se degrada mostrando solo las métricas.
- **El prompt del sistema es el playbook** de `docs/analysis-playbook.md` (viene de la skill que el equipo ya usa; se copia al repo y pasa a ser el artefacto versionado).

Llamada server-side, key de Anthropic solo en el entorno del servidor.

### 2.7 Control de costos

El análisis **no se regenera en cada carga de página**. Reglas:

- Se deberia generar con el click de un boton y a solicitud del usuario.
- Límite duro de regeneraciones por día configurable por variable de entorno, con un valor por defecto conservador.

---

## 3 · Modelo de datos

### 3.1 Contrato del snapshot

Es el mismo del boceto. **No cambiarlo sin necesidad**: ya está probado contra datos reales y el HTML lo consume tal cual.

```ts
type Snapshot = {
  cycle: {
    team: string; // nombre del equipo
    name: string; // "Cycle 3"
    start: string; // "27 jul"
    end: string; // "10 ago"
    taken: string; // momento de la captura
    live: boolean;
    workspace: string; // slug para armar URLs de Linear
  };
  analysis: Analysis | null;
  nodes: Array<{
    id: string; // "MOVO-66"
    short: string; // etiqueta de tarjeta, máx 44 caracteres
    title: string; // título completo
    status: string; // nombre del estado, para mostrar
    type: "completed" | "started" | "unstarted" | "backlog" | "canceled";
    pts: number | null;
    who: string | null;
    parent: string | null;
    inCycle: boolean;
  }>;
  blocks: Array<[string, string]>; // [bloqueante, bloqueado]
};
```

Sobre `short`: en el boceto está escrito a mano y se lee mucho mejor que cualquier truncado automático. En el sistema hay que generarlo, y la heurística actual (quitar prefijo `[servicio]`, extraer lo que sigue a "quiero" en las user stories, cortar a 44) es aceptable pero mejorable. **Candidato claro para usar el modelo**: generar las etiquetas cortas en el mismo llamado que el análisis, y cachearlas por identificador de issue para no repagarlas.

### 3.2 Tablas

```
snapshots      id, cycle_id, team_key, taken_at, payload (jsonb), content_hash
analyses       id, snapshot_id → snapshots, generated_at, model, payload (jsonb),
               input_tokens, output_tokens
sync_log       id, source ('webhook'|'poll'|'manual'), at, changed (bool), error
allowed_users  email, added_at            -- o allowlist en env, decisión abierta
```

`content_hash` sobre el payload normalizado permite saber si algo cambió sin comparar objetos enteros, y es la clave del control de costos.

---

## 4 · Motor de cálculo

Módulo puro, sin dependencias de red ni de framework, en `lib/graph/`. Es el corazón y lo único que necesita cobertura de tests seria.

```ts
buildGraph(snapshot): { preds, succs, orphans }
detectCycles(graph): string[][]              // caminos cíclicos, vacío si es DAG
topoLevels(graph): Record<string, number>    // debe manejar el caso cíclico sin colgarse
longestChain(graph): string[]
bottlenecks(graph, nodes): Array<{ id, downstreamCount, downstreamPoints }>
openBlocks(graph, nodes): Array<[string, string]>
strandedChildren(nodes): Array<{ parent, total, outside: string[] }>
criticalPathLoad(chain, nodes): Array<{ who, issuesOnPath, openIssues }>
diff(prev: Snapshot, next: Snapshot): { resolved, new, unchanged, worsened }
```

`diff` es el que habilita la pregunta 6 y el que hace que la herramienta valga más en la tercera planning que en la primera.

**Fixtures de test obligatorias:** un DAG normal, un grafo con ciclo, un grafo vacío, un nodo aislado, un padre con todos los hijos afuera, estimaciones nulas en el camino crítico, y una relación que apunta a una issue de otro equipo.

El algoritmo de layout del boceto (niveles topológicos + baricentro con cuatro pasadas para reducir cruces) funciona bien con 16 nodos y se puede portar tal cual. **Con 60 nodos hay que revisarlo.** Antes de reescribirlo, medir: si el ciclo típico del equipo tiene menos de 30 issues, no tocar nada.

---

## 5 · Capa de análisis

### 5.1 Entrada al modelo

```
- Metadatos del ciclo: nombre, fechas, días restantes
- Métricas calculadas (todas las de la sección 4)
- Issues resumidas: id, título, estado, tipo, puntos, responsable, padre
- Relaciones de bloqueo
- Señales extraídas de descripciones: menciones de dependencias externas
- Diff contra el snapshot de la planning anterior, si existe
```

### 5.2 Salida esperada

```ts
type Analysis = {
  generated: string;
  headline: string; // una frase: dónde está el ciclo hoy
  decisions: Array<{
    sev: "alta" | "media" | "baja";
    title: string; // la decisión, no la observación
    body: string; // por qué importa y qué opciones hay
    issues: string[]; // identificadores reales, validados contra el snapshot
  }>; // máximo 6
  watchNext: string[]; // qué mirar en la próxima daily
};
```

**Validación posterior obligatoria:** todo identificador que devuelva el modelo tiene que existir en el snapshot. Si menciona una issue inventada, se descarta esa referencia y se registra. Es el guardarraíl más barato contra alucinaciones y hay que tenerlo desde el día uno.

### 5.3 Reglas de redacción

Están en `docs/analysis-playbook.md`, que se copia al repo desde la skill existente. Resumen: cada hallazgo termina en una decisión con opciones reales; severidad alta solo si compromete la fecha o el alcance; si el ciclo no llega, la frase es "no llega"; máximo seis hallazgos; no inventar causas, los datos dicen qué bloquea a qué pero no dicen por qué alguien no empezó algo.

---

## 6 · Interfaz

`docs/mockup.html` es la referencia visual y de interacción. Está en HTML plano con datos embebidos, se abre con doble clic, y contiene ya resueltos: layout por niveles, conectores ortogonales, aislamiento de cadena al hacer clic, panel lateral con detalle y métricas, bloque de decisiones, bandeja de huérfanos y los tres toggles.

**Lenguaje visual, a respetar:** fondo blanco, sin gradientes, una sola familia tipográfica con números tabulares, hairlines grises. El color solo significa: lo terminado se apaga a gris, lo saturado es lo que necesita atención, y las flechas rojas son únicamente las que salen de algo no cerrado. Esa jerarquía es deliberada; al abrirlo, lo primero que se ve es el problema.

**Vistas por versión:**

- **v1** · Grafo del ciclo activo, con el panel y las decisiones. Es lo que hay en el boceto.
- **v1.5** · Modo planning: pantalla completa, sin panel, tipografía más grande, pensado para proyectar. Ojo con esto, que es la razón de ser del proyecto y es fácil que quede para el final.
- **v2** · Histórico: comparar el ciclo actual contra el anterior, ver qué bloqueos sobrevivieron.

---

## 7 · Seguridad

- Ninguna clave (Linear, Anthropic, base de datos) sale del servidor. Verificar que no haya `NEXT_PUBLIC_` en ninguna de ellas.
- Toda ruta bajo autenticación, incluidos los Route Handlers. Un endpoint de API sin sesión anula el login.
- Webhook de Linear con verificación de firma HMAC y validación de IP de origen si Linear la publica.
- Rate limit en el endpoint que dispara análisis. Sin eso, un usuario recargando quema presupuesto de tokens.
- Sin datos personales más allá de nombres de usuarios de Linear y correos de la allowlist.

---

## 8 · Milestones

Cada uno con criterio de aceptación verificable. No avanzar sin cumplirlo.

**M0 · Esqueleto y acceso** — Next.js en Vercel, login por GitHub con allowlist, una página vacía protegida.
_Aceptación:_ una cuenta fuera de la allowlist recibe un rechazo; una cuenta dentro entra.

**M1 · Sincronización** — Consulta GraphQL a Linear, normalización al contrato de Snapshot, persistencia con hash.
_Aceptación:_ el snapshot generado por el sistema es equivalente al del boceto cuando se corre sobre el mismo ciclo.

**M2 · Motor y grafo** — Motor de cálculo con tests, UI portada del boceto consumiendo datos reales.
_Aceptación:_ todas las fixtures pasan, incluida la del grafo con ciclo, sin colgarse.

**M3 · Análisis** — Llamado a Claude, validación con Zod, verificación de identificadores, caché por hash, botón de regeneración.
_Aceptación:_ dos cargas seguidas sin cambios en Linear producen cero llamados al modelo.

**M4 · Actualización automática** — Webhook con firma verificada, polling de respaldo, indicador de frescura en la UI.
_Aceptación:_ un cambio de estado en Linear se refleja en menos de 60 segundos sin recargar a mano.

**M5 · Histórico** — Diff entre snapshots, vista comparativa.
_Aceptación:_ un bloqueo presente en dos planning consecutivas aparece marcado como persistente.

**M1.5, en paralelo y no al final: el modo planning.** Es el caso de uso que justifica el proyecto.

---

## 9 · Riesgos

**Compite con la tesis.** Movo tiene una defensa académica con seis microservicios que deben estar desplegados y un paper por entregar. Esta herramienta es infraestructura de equipo, no entregable. Timeboxearla: si M0 a M3 no están en dos ciclos, cortar y volver al HTML estático, que ya resuelve el 70% del valor con el 5% del esfuerzo. Escribo esto sabiendo que el proyecto es más entretenido que el paper.

**El valor depende de la disciplina del equipo.** Si nadie carga relaciones en Linear, el grafo queda vacío y la herramienta no sirve. Cargar dependencias en el refinamiento es un cambio de proceso que hay que hacer aunque no se construya nada de esto.

**Webhooks de relaciones sin confirmar.** Ver 2.5. Verificarlo antes de diseñar alrededor.

**Costo de tokens sin techo.** Los guardarraíles de 2.7 son parte de M3, no una optimización posterior.

**Sobreajuste a un solo ciclo.** El playbook salió de analizar un ciclo. Los primeros informes van a tener hallazgos flojos o falsos positivos. Está previsto: el playbook es un archivo versionado en el repo, se corrige con cada planning.

---

## 10 · Decisiones abiertas

Para resolver con el equipo antes de M1:

1. **Nombre y repo.** `movo-pulse` es una propuesta.
2. **Neon o Vercel Postgres.** Da lo mismo técnicamente; decidir por el free tier que más convenga.
3. **Allowlist en base de datos o en variable de entorno.** Con cinco personas, la variable alcanza y evita una tabla y una pantalla de administración.
4. **¿Se guarda un snapshot por día o solo uno por planning?** Diario da mejores gráficos de evolución; por planning alcanza para el caso de uso y ocupa mucho menos.
5. **¿Vale un ADR en el repo de Movo?** La decisión de construir herramientas internas propias en vez de usar los add-ons de Linear tiene fundamento y es defendible en la presentación académica.

---

## Anexo · Variables de entorno

```
AUTH_SECRET
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
ALLOWED_EMAILS            # separados por coma
LINEAR_API_KEY            # solo servidor
LINEAR_TEAM_KEY           # "MOVO"
LINEAR_WEBHOOK_SECRET
ANTHROPIC_API_KEY         # solo servidor
DATABASE_URL
MAX_ANALYSES_PER_DAY      # tope de costo
```

## Anexo · Consulta GraphQL de partida

Ya validada contra la API real. Trae el ciclo activo, sus issues, relaciones en ambos sentidos y sub-issues en una sola consulta.

```graphql
query CycleGraph($teamKey: String!) {
  teams(filter: { key: { eq: $teamKey } }, first: 1) {
    nodes {
      key
      name
      activeCycle {
        id
        name
        number
        startsAt
        endsAt
        issues(first: 250) {
          nodes {
            ...Core
            children(first: 50) {
              nodes {
                ...Lite
              }
            }
            relations(first: 50) {
              nodes {
                type
                relatedIssue {
                  ...Lite
                }
              }
            }
            inverseRelations(first: 50) {
              nodes {
                type
                issue {
                  ...Lite
                }
              }
            }
          }
        }
      }
    }
  }
}

fragment Core on Issue {
  identifier
  title
  estimate
  url
  state {
    name
    type
  }
  assignee {
    displayName
  }
  parent {
    identifier
  }
}
fragment Lite on Issue {
  identifier
  title
  estimate
  url
  state {
    name
    type
  }
  assignee {
    displayName
  }
  parent {
    identifier
  }
  cycle {
    id
  }
}
```

Límites a tener en cuenta: corta en 250 issues por ciclo y 50 hijos o relaciones por issue. Para el equipo actual sobra; si se acerca a esos números, paginar. La autenticación va en el header `Authorization` con la key en crudo, **sin** el prefijo `Bearer`.
