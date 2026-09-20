/**
 * Cleans a raw filename or title string by removing extensions, underscores, and extra spaces.
 */
function cleanString(str) {
  if (!str) return '';
  return str
    .replace(/\.pdf$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Heuristically parses book title and author from a filename.
 * Handles patterns like:
 * - "Title by Author"
 * - "Author - Title"
 * - "Title - Author"
 * - "Title"
 */
export function parseBookFilename(filename) {
  const base = cleanString(filename);

  // Pattern 1: "Title by Author"
  const byMatch = base.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return {
      title: cleanString(byMatch[1]),
      author: cleanString(byMatch[2])
    };
  }

  // Pattern 2: "Part1 - Part2"
  const dashMatch = base.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const part1 = cleanString(dashMatch[1]);
    const part2 = cleanString(dashMatch[2]);

    // Check if part1 looks like an author name (e.g. 2-3 words, no numbers)
    const isPart1Author = /^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/.test(part1);
    if (isPart1Author) {
      return { title: part2, author: part1 };
    }
    return { title: part1, author: part2 };
  }

  // Fallback: title is the base name, author is left empty or default
  return {
    title: base,
    author: 'Academic Faculty / Author'
  };
}

/**
 * Finds the best matching branch from existing branches list based on a folder segment.
 */
export function matchBranch(segment, branches = []) {
  if (!segment || !branches.length) return null;
  const segLower = segment.toLowerCase().trim();

  // Exact or contains match
  for (const b of branches) {
    const bLower = b.name.toLowerCase().trim();
    if (bLower === segLower) return b;
    if (bLower.includes(segLower) || segLower.includes(bLower)) return b;
  }

  // Acronym matching (e.g. "CSE" -> "Computer Science and Engineering")
  const acronyms = {
    'cse': 'computer science',
    'cs': 'computer science',
    'it': 'information technology',
    'ec': 'electronics',
    'ece': 'electronics',
    'me': 'mechanical',
    'mech': 'mechanical',
    'ce': 'civil',
    'civil': 'civil',
    'ee': 'electrical',
    'ex': 'electrical'
  };

  const alias = acronyms[segLower];
  if (alias) {
    for (const b of branches) {
      if (b.name.toLowerCase().includes(alias)) return b;
    }
  }

  return null;
}

/**
 * Finds the best matching category from existing categories list based on a folder segment.
 */
export function matchCategory(segment, categories = []) {
  if (!segment || !categories.length) return null;
  const segLower = segment.toLowerCase().trim();

  for (const c of categories) {
    const cLower = c.name.toLowerCase().trim();
    if (cLower === segLower) return c;
    if (cLower.includes(segLower) || segLower.includes(cLower)) return c;
  }
  return null;
}

/**
 * Parses an array of File objects uploaded via webkitdirectory.
 * Returns structured book descriptors ready for review and Supabase upload.
 *
 * @param {FileList|File[]} fileList
 * @param {Array} availableBranches
 * @param {Array} availableCategories
 * @returns {Array} Array of parsed book objects
 */
export function parseDirectoryFiles(fileList, availableBranches = [], availableCategories = []) {
  const files = Array.from(fileList || []).filter(f => 
    f.name.toLowerCase().endsWith('.pdf')
  );

  return files.map((file, index) => {
    const relPath = file.webkitRelativePath || file.name;
    const segments = relPath.split(/[/\\]/).map(s => s.trim()).filter(Boolean);

    let detectedBranch = null;
    let detectedCategory = null;

    // Analyze directory segments
    // Example: ["Computer Science", "Programming", "Clean Code.pdf"]
    if (segments.length >= 3) {
      detectedBranch = matchBranch(segments[0], availableBranches) || matchBranch(segments[1], availableBranches);
      detectedCategory = matchCategory(segments[1], availableCategories) || matchCategory(segments[0], availableCategories);
    } else if (segments.length === 2) {
      // Example: ["Computer Science", "Book.pdf"] OR ["Core Engineering", "Book.pdf"]
      detectedBranch = matchBranch(segments[0], availableBranches);
      detectedCategory = matchCategory(segments[0], availableCategories);
    }

    const { title, author } = parseBookFilename(file.name);

    return {
      id: `batch-${Date.now()}-${index}`,
      file,
      relativePath: relPath,
      fileName: file.name,
      fileSize: file.size,
      title,
      author,
      branch_id: detectedBranch ? detectedBranch.id : (availableBranches[0]?.id || ''),
      branch_name: detectedBranch ? detectedBranch.name : (availableBranches[0]?.name || ''),
      category_id: detectedCategory ? detectedCategory.id : (availableCategories[0]?.id || ''),
      category_name: detectedCategory ? detectedCategory.name : (availableCategories[0]?.name || ''),
      priority: 'main',
      cover_url: null, // to be populated by first page extractor
      status: 'pending' // 'pending' | 'extracting' | 'ready' | 'uploading' | 'completed' | 'error'
    };
  });
}
