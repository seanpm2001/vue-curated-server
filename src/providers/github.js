
import GitHub from 'github-api'

import { parseMarkdownLink, parseGitUrl, parseData, parseRepoId } from '../utils/parse'

const gh = new GitHub({
  token: process.env.GITHUB_TOKEN,
})

const moduleFields = [
  { key: 'vue', array: true },
  { key: 'links', array: true, map: parseMarkdownLink },
  { key: 'status' },
  { key: 'badge' },
]

let sourceRepo = gh.getRepo('Akryum', 'vue-curated')

function generateCategoryId (label) {
  return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/\W/g, '')
}

function generateModuleId (domain, owner, repoName) {
  return `${domain.replace(/\./g, '_')}::${owner}::${repoName}`
}

async function getModuleSource () {
  return sourceRepo.getContents('master', 'PACKAGES.md', true)
}

export function getRepo (owner, name) {
  return gh.getRepo(owner, name)
}

export function getRepoFromId (id) {
  const { owner, name } = parseRepoId(id)
  return getRepo(owner, name)
}

export async function getRepoDetails (repo) {
  try {
    console.log('fetch details')
    const result = await repo.getDetails()
    return result.data
  } catch (e) {
    console.error(e)
  }
}

export async function getRepoReadme (repo) {
  try {
    console.log('fetch readme')
    const result = await repo.getReadme(undefined, true)
    return {
      content: result.data,
    }
  } catch (e) {
    console.error(e)
  }
}

export async function getModules () {
  try {
    const file = await getModuleSource()
    const rawSource = file.data
    const lines = rawSource.split('\n')
    const modules = []
    const categories = []
    const releases = []
    let lastCategory

    for (let line of lines) {
      // Category
      if (line.indexOf('# ') === 0) {
        const label = line.substr(2)
        const id = generateCategoryId(label)

        lastCategory = {
          id,
          label,
        }
        categories.push(lastCategory)
      }

      // Module
      if (line.indexOf('- ') === 0) {
        line = line.substr(2)
        const { fullMatch, label, url } = parseMarkdownLink(line)
        line = line.substr(fullMatch.length)

        const { domain, owner, repoName } = parseGitUrl(url)
        const id = generateModuleId(domain, owner, repoName)

        const data = parseData(line, moduleFields)

        const module = {
          id,
          label,
          url,
          owner,
          repoName,
          category_id: lastCategory.id,
          ...data,
        }

        data.vue.forEach(vue => {
          if (!releases.find(r => r.id === vue)) {
            releases.push({
              id: vue,
              label: `Vue ${vue}`,
            })
          }
        })

        modules.push(module)
      }
    }

    categories.sort((a, b) => a.label < b.label ? -1 : 1)
    releases.sort((a, b) => a.id < b.id ? -1 : 1)

    return {
      modules,
      categories,
      releases,
    }
  } catch (e) {
    console.error(e)
  }
}