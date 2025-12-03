const fs = require('fs');
const path = require('path');

const USERNAME = 'quotentiroler';
const README_PATH = path.join(__dirname, '..', 'README.md');

// ============================================================
// CONFIGURATION - Only thing you need to maintain!
// ============================================================

// Repos to completely exclude (won't appear anywhere)
const EXCLUDE_REPOS = [
  'quotentiroler',  // This profile repo
  'fhir-ig-publisher',
  'smart-launcher-v2', 
  'shlinker',
  'coordinates2country',
  'smart-on-fhir-scheduling-tutorial'
];

// Category definitions - map GitHub topics to sections
// Repos are sorted by stars within each category
const CATEGORIES = {
  'healthcare': {
    title: '🏥 Healthcare & FHIR',
    emoji: '🏥',
    priority: 1
  },
  'edtech': {
    title: '📚 Education & EdTech', 
    emoji: '📚',
    priority: 2
  },
  'ai': {
    title: '🤖 AI & Automation',
    emoji: '🤖', 
    priority: 3
  },
  'analytics': {
    title: '📊 Analytics & Visualization',
    emoji: '📊',
    priority: 4
  },
  'hackathon': {
    title: '🏆 Hackathons',
    emoji: '🏆',
    priority: 5
  },
  'utility': {
    title: '🛠️ Utilities',
    emoji: '🛠️',
    priority: 6
  }
};

// Language badge mappings
const LANGUAGE_BADGES = {
  'TypeScript': { color: '007ACC', logo: 'typescript' },
  'JavaScript': { color: 'F7DF1E', logo: 'javascript', logoColor: 'black' },
  'Python': { color: '3776AB', logo: 'python' },
  'Java': { color: 'ED8B00', logo: 'openjdk' },
  'C#': { color: '239120', logo: 'csharp' },
  'HTML': { color: 'E34F26', logo: 'html5' },
  'CSS': { color: '1572B6', logo: 'css3' },
  'Go': { color: '00ADD8', logo: 'go' },
  'Rust': { color: '000000', logo: 'rust' },
  'Ruby': { color: 'CC342D', logo: 'ruby' },
  'PHP': { color: '777BB4', logo: 'php' },
  'Shell': { color: '4EAA25', logo: 'gnu-bash' },
  'Kotlin': { color: '7F52FF', logo: 'kotlin' },
  'Swift': { color: 'F05138', logo: 'swift' }
};

// ============================================================
// FETCHING & PROCESSING
// ============================================================

async function fetchRepos() {
  const response = await fetch(
    `https://api.github.com/users/${USERNAME}/repos?per_page=100&type=owner`
  );
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  const repos = await response.json();
  
  // Filter: public, not fork, not archived, not excluded
  return repos.filter(repo => 
    !repo.private && 
    !repo.fork && 
    !repo.archived &&
    !EXCLUDE_REPOS.includes(repo.name)
  );
}

function categorizeRepos(repos) {
  const categorized = {};
  const uncategorized = [];
  
  // Initialize categories
  Object.keys(CATEGORIES).forEach(key => {
    categorized[key] = [];
  });
  
  repos.forEach(repo => {
    const topics = repo.topics || [];
    let placed = false;
    
    // Check each topic against our categories
    for (const topic of topics) {
      if (CATEGORIES[topic]) {
        categorized[topic].push(repo);
        placed = true;
        break; // Only place in first matching category
      }
    }
    
    if (!placed) {
      uncategorized.push(repo);
    }
  });
  
  // Sort each category by stars (descending)
  Object.keys(categorized).forEach(key => {
    categorized[key].sort((a, b) => b.stargazers_count - a.stargazers_count);
  });
  
  // Sort uncategorized by update time
  uncategorized.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  
  return { categorized, uncategorized };
}

// ============================================================
// MARKDOWN GENERATION
// ============================================================

function getLanguageBadge(language) {
  if (!language || !LANGUAGE_BADGES[language]) {
    return '';
  }
  const badge = LANGUAGE_BADGES[language];
  const logoColor = badge.logoColor || 'white';
  return `<img src="https://img.shields.io/badge/${encodeURIComponent(language)}-${badge.color}?style=for-the-badge&logo=${badge.logo}&logoColor=${logoColor}" alt="${language}"/>`;
}

function generateRepoCard(repo) {
  const langBadge = getLanguageBadge(repo.language);
  const description = repo.description || 'No description available.';
  const hasHomepage = repo.homepage && repo.homepage.trim() !== '';
  
  let links = `<a href="${repo.html_url}">📂 Repository</a>`;
  if (hasHomepage) {
    links += ` | <a href="${repo.homepage}">🌐 Demo</a>`;
  }
  
  return `
      <h3 align="center">${repo.name}</h3>
      <p align="center">
        <a href="${repo.html_url}">
          ${langBadge}
        </a>
        <a href="${repo.html_url}">
          <img src="https://img.shields.io/github/stars/${USERNAME}/${repo.name}?style=for-the-badge" alt="Stars"/>
        </a>
      </p>
      <p align="center">
        ${description}
      </p>
      <p align="center">
        ${links}
      </p>`;
}

function generateCategorySection(categoryKey, repos) {
  if (repos.length === 0) return '';
  
  const category = CATEGORIES[categoryKey];
  const rows = [];
  
  for (let i = 0; i < repos.length; i += 2) {
    const repo1 = repos[i];
    const repo2 = repos[i + 1];
    
    let row = `  <tr>
    <td width="50%">${generateRepoCard(repo1)}
    </td>`;
    
    if (repo2) {
      row += `
    <td width="50%">${generateRepoCard(repo2)}
    </td>`;
    } else {
      row += `
    <td width="50%">
    </td>`;
    }
    
    row += `
  </tr>`;
    rows.push(row);
  }
  
  return `### ${category.title}

<table>
${rows.join('\n')}
</table>

`;
}

function generateRecentSection(repos) {
  if (repos.length === 0) {
    return '*No uncategorized repos. Add topics to your repos to categorize them!*';
  }
  
  const recentRepos = repos.slice(0, 4);
  const rows = [];
  
  for (let i = 0; i < recentRepos.length; i += 2) {
    const repo1 = recentRepos[i];
    const repo2 = recentRepos[i + 1];
    
    let row = `<tr>
    <td width="50%">
      <a href="${repo1.html_url}">
        <img src="https://github-readme-stats.vercel.app/api/pin/?username=${USERNAME}&repo=${repo1.name}&theme=tokyonight&hide_border=true" alt="${repo1.name}"/>
      </a>
    </td>`;
    
    if (repo2) {
      row += `
    <td width="50%">
      <a href="${repo2.html_url}">
        <img src="https://github-readme-stats.vercel.app/api/pin/?username=${USERNAME}&repo=${repo2.name}&theme=tokyonight&hide_border=true" alt="${repo2.name}"/>
      </a>
    </td>`;
    } else {
      row += `
    <td width="50%">
    </td>`;
    }
    
    row += `
  </tr>`;
    rows.push(row);
  }
  
  return `<div align="center">
<table>
  ${rows.join('\n  ')}
</table>
</div>`;
}

function generateLastUpdated() {
  const now = new Date();
  return `*Last updated: ${now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })}*`;
}

function generateFeaturedProjects(categorized) {
  let content = '';
  
  // Sort categories by priority
  const sortedCategories = Object.keys(CATEGORIES)
    .sort((a, b) => CATEGORIES[a].priority - CATEGORIES[b].priority);
  
  for (const categoryKey of sortedCategories) {
    const repos = categorized[categoryKey];
    if (repos.length > 0) {
      content += generateCategorySection(categoryKey, repos);
    }
  }
  
  return content.trim();
}

// ============================================================
// MAIN UPDATE FUNCTION
// ============================================================

async function updateReadme() {
  console.log('Fetching repos from GitHub API...');
  const repos = await fetchRepos();
  console.log(`Found ${repos.length} public non-fork repos`);
  
  const { categorized, uncategorized } = categorizeRepos(repos);
  
  // Log categorization results
  Object.keys(categorized).forEach(key => {
    if (categorized[key].length > 0) {
      console.log(`  ${CATEGORIES[key].title}: ${categorized[key].map(r => r.name).join(', ')}`);
    }
  });
  if (uncategorized.length > 0) {
    console.log(`  ⚠️ Uncategorized (add topics!): ${uncategorized.map(r => r.name).join(', ')}`);
  }
  
  // Generate content
  const featuredContent = generateFeaturedProjects(categorized);
  const lastUpdated = generateLastUpdated();
  
  console.log('\nReading README.md...');
  let readme = fs.readFileSync(README_PATH, 'utf8');
  
  // Replace featured projects section
  const featuredRegex = /<!-- FEATURED-PROJECTS:START -->[\s\S]*?<!-- FEATURED-PROJECTS:END -->/;
  if (featuredRegex.test(readme)) {
    readme = readme.replace(
      featuredRegex,
      `<!-- FEATURED-PROJECTS:START -->\n${featuredContent}\n\n${lastUpdated}\n<!-- FEATURED-PROJECTS:END -->`
    );
    console.log('Updated featured projects section.');
  } else {
    console.log('No FEATURED-PROJECTS markers found in README.');
  }
  
  fs.writeFileSync(README_PATH, readme);
  console.log('\n✅ README.md updated successfully!');
  
  if (uncategorized.length > 0) {
    console.log('\n📋 To categorize remaining repos, add these topics on GitHub:');
    Object.keys(CATEGORIES).forEach(key => {
      console.log(`   - "${key}" → ${CATEGORIES[key].title}`);
    });
  }
}

updateReadme().catch(err => {
  console.error('Error updating README:', err);
  process.exit(1);
});
