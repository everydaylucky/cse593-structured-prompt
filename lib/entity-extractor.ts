/**
 * 快速实体识别模块
 * 使用纯 JavaScript 模式匹配，无需外部依赖，无 token 消耗
 */

export interface EntityExtractionResult {
  persons: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  emails: string[];
  urls: string[];
  currencies: string[];
  percentages: string[];
}

/**
 * 快速提取所有实体类型
 */
export function extractEntitiesFast(text: string): EntityExtractionResult {
  const result: EntityExtractionResult = {
    persons: [],
    organizations: [],
    locations: [],
    dates: [],
    emails: [],
    urls: [],
    currencies: [],
    percentages: [],
  };

  // 并行提取所有实体类型
  result.persons = extractPersons(text);
  result.organizations = extractOrganizations(text);
  result.locations = extractLocations(text);
  result.dates = extractDates(text);
  result.emails = extractEmails(text);
  result.urls = extractUrls(text);
  result.currencies = extractCurrencies(text);
  result.percentages = extractPercentages(text);

  return result;
}

/**
 * 提取人名
 */
function extractPersons(text: string): string[] {
  const persons = new Set<string>();

  // 模式1：大写字母开头的连续词（2-4个词）
  // 例如：John Smith, Mary Jane Watson, Dr. John Smith
  const personPattern1 = /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Professor)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g;
  const matches1 = text.match(personPattern1);
  if (matches1) {
    matches1.forEach(m => persons.add(m.trim()));
  }

  // 模式2：两个大写字母开头的词（常见人名格式）
  const personPattern2 = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
  const matches2 = text.match(personPattern2);
  if (matches2) {
    matches2.forEach(m => {
      // 排除常见非人名（如地名、组织名）
      if (!isCommonNonPerson(m)) {
        persons.add(m.trim());
      }
    });
  }

  // 模式3：三个大写字母开头的词（可能是全名）
  const personPattern3 = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g;
  const matches3 = text.match(personPattern3);
  if (matches3) {
    matches3.forEach(m => {
      if (!isCommonNonPerson(m)) {
        persons.add(m.trim());
      }
    });
  }

  // 上下文线索：said, according to, reported by 等后面的可能是人名
  const contextPattern = /\b(?:said|according to|reported by|authored by|written by|by)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/gi;
  const contextMatches = text.match(contextPattern);
  if (contextMatches) {
    contextMatches.forEach(m => {
      const name = m.replace(/\b(?:said|according to|reported by|authored by|written by|by)\s+/i, '').trim();
      if (name) {
        persons.add(name);
      }
    });
  }

  return Array.from(persons).slice(0, 50); // 限制最多50个
}

/**
 * 提取组织名
 */
function extractOrganizations(text: string): string[] {
  const organizations = new Set<string>();

  // 组织后缀
  const orgSuffixes = [
    'Inc\\.', 'Ltd\\.', 'Corp\\.', 'Corporation', 'Company', 'Co\\.',
    'LLC', 'LLP', 'Foundation', 'Institute', 'University',
    'College', 'Hospital', 'Bank', 'Group', 'Systems', 'Solutions',
    'Technologies', 'Tech', 'Labs', 'Laboratories', 'Research',
    'Center', 'Centre', 'Association', 'Society', 'Organization',
    'Agency', 'Department', 'Ministry', 'Bureau', 'Office'
  ];

  // 匹配：词 + 组织后缀
  const orgPattern = new RegExp(
    `\\b[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)*\\s+(?:${orgSuffixes.join('|')})\\b`,
    'gi'
  );
  const matches = text.match(orgPattern);
  if (matches) {
    matches.forEach(m => organizations.add(m.trim()));
  }

  // 常见组织模式：The + 组织名
  const theOrgPattern = /\bThe\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+(?:of|for|in))?\s+[A-Z][a-zA-Z]+\b/g;
  const theMatches = text.match(theOrgPattern);
  if (theMatches) {
    theMatches.forEach(m => {
      if (m.length < 100) { // 避免匹配过长的句子
        organizations.add(m.trim());
      }
    });
  }

  return Array.from(organizations).slice(0, 50);
}

/**
 * 提取地点
 */
function extractLocations(text: string): string[] {
  const locations = new Set<string>();

  // 地点后缀
  const locationSuffixes = [
    'City', 'State', 'Country', 'Street', 'Avenue', 'Road',
    'Park', 'Square', 'Plaza', 'Building', 'Tower', 'Bridge',
    'River', 'Lake', 'Mountain', 'Island', 'Bay', 'Ocean',
    'Continent', 'Region', 'Province', 'County', 'District'
  ];

  // 匹配：词 + 地点后缀
  const locationPattern = new RegExp(
    `\\b[A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)*\\s+(?:${locationSuffixes.join('|')})\\b`,
    'g'
  );
  const matches = text.match(locationPattern);
  if (matches) {
    matches.forEach(m => locations.add(m.trim()));
  }

  // 常见城市/国家模式
  const commonPlaces = [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
    'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
    'London', 'Paris', 'Tokyo', 'Beijing', 'Shanghai', 'Berlin',
    'United States', 'United Kingdom', 'China', 'Japan', 'Germany',
    'France', 'Canada', 'Australia', 'India', 'Brazil'
  ];

  commonPlaces.forEach(place => {
    const regex = new RegExp(`\\b${place.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    if (regex.test(text)) {
      locations.add(place);
    }
  });

  return Array.from(locations).slice(0, 50);
}

/**
 * 提取日期
 */
function extractDates(text: string): string[] {
  const dates = new Set<string>();

  // 模式1：YYYY-MM-DD
  const isoPattern = /\b\d{4}-\d{2}-\d{2}\b/g;
  const isoMatches = text.match(isoPattern);
  if (isoMatches) {
    isoMatches.forEach(m => dates.add(m));
  }

  // 模式2：MM/DD/YYYY 或 DD/MM/YYYY
  const slashPattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
  const slashMatches = text.match(slashPattern);
  if (slashMatches) {
    slashMatches.forEach(m => dates.add(m));
  }

  // 模式3：月份名称 + 日期 + 年份
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthPattern = new RegExp(
    `\\b(?:${months.join('|')})\\s+\\d{1,2},?\\s+\\d{4}\\b`,
    'gi'
  );
  const monthMatches = text.match(monthPattern);
  if (monthMatches) {
    monthMatches.forEach(m => dates.add(m.trim()));
  }

  // 模式4：年份（1900-2100）
  const yearPattern = /\b(?:19|20)\d{2}\b/g;
  const yearMatches = text.match(yearPattern);
  if (yearMatches) {
    yearMatches.forEach(m => {
      const year = parseInt(m);
      if (year >= 1900 && year <= 2100) {
        dates.add(m);
      }
    });
  }

  return Array.from(dates).slice(0, 30);
}

/**
 * 提取邮箱
 */
function extractEmails(text: string): string[] {
  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  const matches = text.match(emailPattern);
  return matches ? Array.from(new Set(matches)).slice(0, 20) : [];
}

/**
 * 提取URL
 */
function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlPattern);
  return matches ? Array.from(new Set(matches)).slice(0, 20) : [];
}

/**
 * 提取货币
 */
function extractCurrencies(text: string): string[] {
  const currencies = new Set<string>();

  // 美元
  const usdPattern = /\$[\d,]+(?:\.\d{2})?\b/g;
  const usdMatches = text.match(usdPattern);
  if (usdMatches) {
    usdMatches.forEach(m => currencies.add(m));
  }

  // 其他货币符号
  const currencyPattern = /(?:€|£|¥|₹|₽)[\d,]+(?:\.\d{2})?\b/g;
  const currencyMatches = text.match(currencyPattern);
  if (currencyMatches) {
    currencyMatches.forEach(m => currencies.add(m));
  }

  // 货币代码
  const codePattern = /\b(?:USD|EUR|GBP|JPY|CNY|INR|RUB)\s+[\d,]+(?:\.\d{2})?\b/gi;
  const codeMatches = text.match(codePattern);
  if (codeMatches) {
    codeMatches.forEach(m => currencies.add(m.trim()));
  }

  return Array.from(currencies).slice(0, 20);
}

/**
 * 提取百分比
 */
function extractPercentages(text: string): string[] {
  const percentagePattern = /\b\d+(?:\.\d+)?\s*%/g;
  const matches = text.match(percentagePattern);
  return matches ? Array.from(new Set(matches)).slice(0, 20) : [];
}

/**
 * 判断是否为常见非人名（避免误识别）
 */
function isCommonNonPerson(text: string): boolean {
  const commonNonPersons = [
    'United States', 'New York', 'Los Angeles', 'San Francisco',
    'United Kingdom', 'United Nations', 'European Union',
    'World War', 'World Health', 'World Bank', 'World Trade',
    'State Department', 'White House', 'Supreme Court',
    'New York Times', 'Wall Street', 'Silicon Valley',
    'Middle East', 'South America', 'North America',
    'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean'
  ];

  return commonNonPersons.some(nonPerson => 
    text.toLowerCase().includes(nonPerson.toLowerCase())
  );
}

