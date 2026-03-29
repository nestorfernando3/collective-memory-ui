const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, 'projects');

const projectsList = [
  { id: 'fenomenologia-rumor', name: 'Fenomenología del Rumor', type: 'Investigación', status: 'En desarrollo', path: '~/Documents/ARTÍCULOS/EL CHISME', tags: ['investigación', 'semiótica', 'sociología urbana'] },
  { id: 'pca-mincultura', name: 'PCA MinCultura 2026', type: 'Cultural', status: 'Enviado', path: '~/Documents/proyectos mincultura 2026/PCA', tags: ['cultural', 'gestión', 'estado'] },
  { id: 'generacion-2030', name: 'Generación 2030 / Formación en Artes', type: 'Cultural', status: 'En postulación', path: '~/Documents/proyectos mincultura 2026/formación en artes', tags: ['cultural', 'educación', 'artes'] },
  { id: 'pei-brisas-del-rio', name: 'PEI Brisas del Río 2026', type: 'Institucional', status: 'En construcción', path: '~/Documents/PEI 2026', tags: ['institucional', 'educación pública', 'diseño instruccional'] },
  { id: 'gestiones-brisas', name: 'Gestiones Brisas del Río', type: 'Institucional', status: 'Activo', path: '~/Documents/GESTIONES BRISAS DEL RIO 2026', tags: ['institucional', 'gestión escolar'] },
  { id: 'proyecto-icfes', name: 'Proyecto ICFEs', type: 'Educación', status: 'Materiales listos', path: '~/Documents/Proyecto ICFEs', tags: ['educación', 'pruebas de estado', 'instruccional'] },
  { id: 'concertacion-mincultura', name: 'Concertación MinCultura', type: 'Cultural', status: 'En ejecución', path: '~/Documents/CONCERTACIÓN MINCULTURA', tags: ['cultural', 'gestión cultural', 'ejecución'] },
  { id: 'las-camilas', name: 'Las Camilas', type: 'Creativo', status: 'Libro formateado', path: '~/Documents/Las Camilas - Textos selectos', tags: ['creativo', 'literatura', 'caribe'] },
  { id: 'dos-cuentos-hermanos', name: 'Dos Cuentos Hermanos', type: 'Creativo', status: 'Maquetado', path: '~/Documents/dos cuentos hermanos', tags: ['creativo', 'literatura', 'infantil'] },
  { id: 'diario-emociones', name: 'Diario de Emociones', type: 'Desarrollo', status: 'En desarrollo', path: '~/Documents/Desarrollo/Diario de Emociones', tags: ['edtech', 'desarrollo', 'psicología'] },
  { id: 'markdown-pedagogico', name: 'Markdown Pedagógico', type: 'EdTech', status: 'En desarrollo', path: '~/Documents/Desarrollo/Markdown editor', tags: ['edtech', 'desarrollo', 'tecnología educativa'] },
  { id: 'kansas-barranquilla', name: 'Estudio Kansas-Barranquilla', type: 'Investigación', status: 'Completo', path: '~/', tags: ['investigación', 'datos', 'epidemiología'] },
  { id: 'examenes-planeacion', name: 'Exámenes y Planeación', type: 'Educación', status: 'Activo', path: '~/Documents/Exámenes y Planeación clase', tags: ['educación', 'secundaria', 'pedagogía'] },
  { id: 'articulo-kevin-cerra', name: 'Artículo Kevin Cerra', type: 'Investigación', status: 'En proceso', path: '~/Documents/Artículo Kevin Cerra', tags: ['investigación', 'co-autoría', 'académico'] }
];

if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

projectsList.forEach(p => {
  const filePath = path.join(PROJECTS_DIR, `${p.id}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(p, null, 2), 'utf-8');
    console.log(`Created ${p.id}.json`);
  } else {
    console.log(`${p.id}.json already exists`);
  }
});

console.log('Done generating project JSONs');
