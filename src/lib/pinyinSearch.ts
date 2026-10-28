import { pinyin } from 'pinyin-pro'

interface PinyinIndex {
  /** 连写全拼，如 陈圆 → chenyuan */
  full: string
  /** 每个音节首字母，如 陈圆 → cy */
  initials: string
  /** 带空格的全拼，用于下拉提示，如 chen yuan */
  display: string
}

const indexCache = new Map<string, PinyinIndex>()

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/[\s·,，、/\\_-]+/g, '')
}

function buildIndex(name: string): PinyinIndex {
  const cached = indexCache.get(name)
  if (cached) return cached

  // 姓氏模式可正确处理「曾」「单」「解」等多音姓氏；nonZh 保留英文名
  const syllables = pinyin(name, {
    mode: 'surname',
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive',
    v: true,
  })
    .map((syllable) => syllable.toLowerCase())
    .filter(Boolean)

  const index: PinyinIndex = {
    full: syllables.join(''),
    initials: syllables.map((syllable) => syllable[0] ?? '').join(''),
    display: syllables.filter((syllable) => /^[a-z]+$/.test(syllable)).join(' '),
  }
  indexCache.set(name, index)
  return index
}

/**
 * 员工姓名匹配分数，分数越高越优先；-1 表示不匹配。
 * 支持中文、全拼（chenyuan）、空格全拼（chen yuan）、首字母（cy）以及部分拼音。
 */
export function scoreEmployeeKeyword(name: string, keyword: string): number {
  const query = normalizeKeyword(keyword)
  if (!query) return 0

  const plainName = normalizeKeyword(name)
  if (plainName === query) return 100
  if (plainName.startsWith(query)) return 90
  if (plainName.includes(query)) return 80

  const index = buildIndex(name)
  if (!index.full) return -1

  if (index.full === query) return 70
  if (index.full.startsWith(query)) return 60
  if (index.initials === query) return 50
  if (index.initials.startsWith(query)) return 40
  if (index.full.includes(query)) return 30
  if (index.initials.includes(query)) return 20

  return -1
}

export function matchesEmployeeKeyword(name: string, keyword: string): boolean {
  return scoreEmployeeKeyword(name, keyword) >= 0
}

/** 下拉候选中展示的拼音，如「chen yuan」 */
export function employeePinyinLabel(name: string): string {
  return buildIndex(name).display
}
