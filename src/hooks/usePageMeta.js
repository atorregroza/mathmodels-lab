import { useEffect } from 'react'
import { siteMetadata } from '../data/seoConfig'

const getOrCreateMeta = (selector, createAttributes) => {
  const existing = document.querySelector(selector)
  if (existing) return existing

  if (!createAttributes) return null

  const meta = document.createElement('meta')
  Object.entries(createAttributes).forEach(([key, value]) => meta.setAttribute(key, value))
  document.head.appendChild(meta)
  return meta
}

const getOrCreateLink = (rel, createAttributes) => {
  const selector = `link[rel="${rel}"]`
  const existing = document.querySelector(selector)
  if (existing) return existing

  if (!createAttributes) return null

  const link = document.createElement('link')
  link.setAttribute('rel', rel)
  Object.entries(createAttributes).forEach(([key, value]) => link.setAttribute(key, value))
  document.head.appendChild(link)
  return link
}

const setMetaContent = (selector, content, createAttributes) => {
  const meta = getOrCreateMeta(selector, createAttributes)
  if (!meta) return { element: null, previous: null }

  const previous = meta.getAttribute('content')
  meta.setAttribute('content', content)
  return { element: meta, previous }
}

const setLinkHref = (rel, href, createAttributes) => {
  const link = getOrCreateLink(rel, createAttributes)
  if (!link) return { element: null, previous: null }

  const previous = link.getAttribute('href')
  link.setAttribute('href', href)
  return { element: link, previous }
}

/**
 * Hook to manage page-level meta tags for SEO
 * @param {Object} options - SEO configuration options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.keywords - Comma-separated keywords
 * @param {string} options.path - Page path (e.g., '/about')
 * @param {string} options.image - OG image path (relative or absolute)
 */
export const usePageMeta = ({ title, description, keywords, path, image } = {}) => {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const previousTitle = document.title
    if (title) document.title = title

    const updates = []
    const { siteUrl, siteName, locale, defaultImage } = siteMetadata

    // Description meta tags
    if (description) {
      updates.push(setMetaContent('meta[name="description"]', description, { name: 'description' }))
      updates.push(setMetaContent('meta[property="og:description"]', description, { property: 'og:description' }))
      updates.push(setMetaContent('meta[name="twitter:description"]', description, { name: 'twitter:description' }))
    }

    // Title meta tags
    if (title) {
      updates.push(setMetaContent('meta[property="og:title"]', title, { property: 'og:title' }))
      updates.push(setMetaContent('meta[name="twitter:title"]', title, { name: 'twitter:title' }))
    }

    // Keywords meta tag
    if (keywords) {
      updates.push(setMetaContent('meta[name="keywords"]', keywords, { name: 'keywords' }))
    }

    // Canonical URL and og:url
    if (path) {
      const fullUrl = `${siteUrl}${path}`
      updates.push(setLinkHref('canonical', fullUrl, {}))
      updates.push(setMetaContent('meta[property="og:url"]', fullUrl, { property: 'og:url' }))
    }

    // OG Image (use provided image or default)
    const ogImage = image || defaultImage
    if (ogImage) {
      const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`
      updates.push(setMetaContent('meta[property="og:image"]', fullImageUrl, { property: 'og:image' }))
      updates.push(setMetaContent('meta[name="twitter:image"]', fullImageUrl, { name: 'twitter:image' }))
    }

    // OG locale and site_name (ensure they're set)
    updates.push(setMetaContent('meta[property="og:locale"]', locale, { property: 'og:locale' }))
    updates.push(setMetaContent('meta[property="og:site_name"]', siteName, { property: 'og:site_name' }))

    // Cleanup function
    return () => {
      document.title = previousTitle
      updates.forEach(({ element, previous }) => {
        if (!element) return
        if (previous === null) {
          element.remove()
          return
        }
        if (element.tagName === 'META') {
          element.setAttribute('content', previous)
        } else if (element.tagName === 'LINK') {
          element.setAttribute('href', previous)
        }
      })
    }
  }, [title, description, keywords, path, image])
}
