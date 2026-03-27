/**
 * Configuración centralizada del sitio
 * Todos los enlaces externos, redes sociales, emails y formularios
 */

export const siteConfig = {
  // Autora
  author: {
    name: 'Astrid Lizbeth Torregroza Olivero',
    title: 'Licenciada en Matemáticas y Física',
  },

  // Redes sociales
  social: {
    instagram: 'https://www.instagram.com/maryammath_academy',
    facebook: 'https://www.facebook.com/laolibero/',
    linkedin: 'https://www.linkedin.com/in/astrid-torregroza/',
  },

  // WhatsApp
  whatsapp: {
    number: '573178778635',
    displayNumber: '+57 317 877 8635',
  },

  // Emails de contacto
  emails: {
    main: 'alizbel14@gmail.com',
    mexico: 'cotomathix@gmail.com',
    mexicoAlt: 'gabrielavelazcom@albertocoto.com',
  },

  // URLs externas
  external: {
    maryamAcademy: 'https://maryam.academy',
    albertoCoto: 'https://albertocoto.com/plataforma',
  },

  // Formularios (API endpoints)
  forms: {
    contact: '/api/contact',
    olympiad: '/api/register',
  },

  // Video de inscripción
  video: {
    youtubeId: 'VjN_HjixUzc',
    title: 'Cómo inscribirse a la Olimpiada 2026',
  },

  // Olimpiadas Iberoamericanas
  olympiad: {
    competitionStart: '2026-03-22',
    competitionEnd: '2026-03-27',
    competitionDateDisplay: '22 al 27 de marzo de 2026',
  },
}

/**
 * Genera una URL de WhatsApp con mensaje personalizado
 * @param {string} [customMessage] - Mensaje personalizado (opcional)
 * @returns {string} URL de WhatsApp
 */
export const getWhatsAppUrl = (customMessage) => {
  const defaultMessage = 'Hola, me gustaría obtener más información sobre los servicios de Astrid Torregroza'
  const message = customMessage || defaultMessage
  return `https://wa.me/${siteConfig.whatsapp.number}?text=${encodeURIComponent(message)}`
}
