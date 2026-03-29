# 🧠 Memoria Colectiva PWA

**Sistema Operativo Personal y Visualización de Portafolio Investigativo**

Un PWA interactivo diseñado para Néstor De León, que visualiza su red interconectada de proyectos de investigación, intervenciones culturales y desarrollos en tecnología educativa (EdTech).

## 🏛 La Interfaz (Estética & Diseño)
El proyecto rechaza los tropos genéricos de diseño IA (bordes redondeados, neon glows, transparencias borrosas) abrazando el **Editorial Brutalism**:
- **Tipografía Fundacional:** Space Grotesk (Títulos de alto impacto) y Lora (Cuerpos serif para legibilidad académica).
- **Contraste Material:** Fondo color papel periódico continuo (`#F2EFE9`), cajas rígidas con bordes negros marcados (`#1A1A1A`) y sombras de desplazamiento sólido (offset shadows).
- **Acentos Crudos:** Se confía en el rojo purista (`#E63946`) para estados activos, conexiones vitales e interactividad directa.

## ⚙️ Arquitectura "Autopilot"
La aplicación no almacena su estado manualmente. El flujo de datos depende de un demonio de sincronización (Vía un Skill IA para LLMs):

1. **La Base de Datos Maestra:** Toda la data canónica de un proyecto reside localmente en tarjetas estáticas `.json` ubicadas bajo `~/.nestor-memoria/projects/` en la máquina del investigador.
2. **El Sincronizador:** Un script BASH (`sync.sh`) que vigila o "escucha" mediante IA cualquier avance metodológico en una carpeta del host, transfiere y regenera un índice dinámico a la carpeta React (`public/data/`).
3. **El Disparador de Flujo CI/CD:** El Autopilot captura los cambios del cerebro local, los inyecta a Git y lanza automáticamente un despliegue transparente hacia **GitHub Pages**.

## 🚀 Despliegue Configurado
Este sistema está atado a *Static Web Deploy* de Netlify o **GitHub Pages**, utilizando Vite + React Flow para el renderizado del grafo espacial. Las vistas ("Lentes") son intercambiables y ajustan programáticamente el campo de nodos dependiendo el contexto discursivo de los proyectos académicos vs institucionales.
