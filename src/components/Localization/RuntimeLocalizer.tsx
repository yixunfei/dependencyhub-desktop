import { useLayoutEffect } from 'react'
import type { FC } from 'react'
import { translateText } from '../../i18n'
import { AppLanguage, useSettingsStore } from '../../stores/settingsStore'

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt']
const originalTextNodes = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()

const hasCjk = (value: string) => /[\u3400-\u9fff]/.test(value)

export const RuntimeLocalizer: FC = () => {
  const language = useSettingsStore((state) => state.language)

  useLayoutEffect(() => {
    if (typeof document === 'undefined' || !document.body) return

    const localizeNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        localizeTextNode(node as Text, language)
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return

      const element = node as Element
      if (shouldSkipElement(element)) return

      localizeElementAttributes(element, language)

      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (candidate) => {
            if (candidate.nodeType === Node.ELEMENT_NODE && shouldSkipElement(candidate as Element)) {
              return NodeFilter.FILTER_REJECT
            }
            return NodeFilter.FILTER_ACCEPT
          }
        }
      )

      while (walker.nextNode()) {
        const current = walker.currentNode
        if (current.nodeType === Node.TEXT_NODE) {
          localizeTextNode(current as Text, language)
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          localizeElementAttributes(current as Element, language)
        }
      }
    }

    localizeNode(document.body)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          localizeChangedTextNode(mutation.target as Text, language)
        } else if (mutation.type === 'attributes') {
          localizeElementAttributes(mutation.target as Element, language)
        } else {
          mutation.addedNodes.forEach(localizeNode)
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    })

    return () => observer.disconnect()
  }, [language])

  return null
}

function localizeTextNode(node: Text, language: AppLanguage) {
  const parent = node.parentElement
  if (!parent || shouldSkipElement(parent)) return

  const current = node.textContent || ''
  const original = originalTextNodes.get(node)

  if (language === 'zh-CN') {
    if (original && current !== original) {
      if (hasCjk(current)) {
        // React just wrote new Chinese source text — it wins (last writer
        // wins); adopt it immediately so this scan cannot clobber it.
        originalTextNodes.set(node, current)
      } else {
        // The current value is a stale foreign-language translation left by
        // a previous switch: restore the recorded source text.
        node.textContent = original
      }
    }
    return
  }

  if (!hasCjk(current)) {
    if (!original) return
    // A non-CJK value here is either this localizer's own translation or new
    // content React just wrote (a counter, a version string). Blindly
    // re-applying the translation of the recorded source overwrote React's
    // new value — and React, believing the DOM is current, never corrected it.
    // If it matches our translation it is our own write: leave it. Otherwise
    // React wrote it and wins: adopt it as the new source.
    if (current === translateText(language, original)) return
    originalTextNodes.set(node, current)
    return
  }

  const source = current
  const translated = translateText(language, source)

  if (hasCjk(source)) {
    originalTextNodes.set(node, source)
  }

  if (translated !== current) {
    node.textContent = translated
  }
}

function localizeChangedTextNode(node: Text, language: AppLanguage) {
  if (language !== 'zh-CN') {
    localizeTextNode(node, language)
    return
  }

  const current = node.textContent || ''
  const original = originalTextNodes.get(node)

  // In zh-CN the stored original is the untranslated source. A mismatch here
  // means React just wrote new content (e.g. a live counter) — adopt it as the
  // new source instead of clobbering it with the stale recorded text
  // ("last writer wins").
  if (original && current !== original) {
    originalTextNodes.set(node, current)
  }
}

function localizeElementAttributes(element: Element, language: AppLanguage) {
  if (shouldSkipElement(element)) return

  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attr)
    if (!current) continue

    const originalMap = originalAttributes.get(element)
    const original = originalMap?.get(attr)

    if (language === 'zh-CN') {
      if (original && current !== original) {
        if (hasCjk(current)) {
          // React just rewrote the attribute with new Chinese source text —
          // adopt it, last writer wins.
          rememberAttribute(element, attr, current)
        } else {
          // The current value is a stale foreign-language translation from a
          // previous switch. React never rewrites the attribute on a language
          // switch, so without restoring it here the attribute would stay in
          // the foreign language until some unrelated prop change.
          element.setAttribute(attr, original)
        }
      }
      continue
    }

    if (!hasCjk(current) && !original) continue

    const source = hasCjk(current) ? current : original || current
    const translated = translateText(language, source)

    if (hasCjk(source)) {
      rememberAttribute(element, attr, source)
    }

    if (translated !== current) {
      element.setAttribute(attr, translated)
    }
  }
}

function rememberAttribute(element: Element, attr: string, value: string) {
  let attrs = originalAttributes.get(element)
  if (!attrs) {
    attrs = new Map<string, string>()
    originalAttributes.set(element, attrs)
  }
  attrs.set(attr, value)
}

function shouldSkipElement(element: Element): boolean {
  return !!element.closest('script, style, code, pre, textarea, [data-no-localize], [contenteditable="true"]')
}
