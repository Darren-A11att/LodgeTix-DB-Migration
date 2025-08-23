import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Similarity algorithm implementations
class SimilarityAlgorithms {
  /**
   * Levenshtein distance (edit distance)
   * Returns normalized similarity score (0-1, where 1 is identical)
   */
  static levenshteinSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [];
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const maxLength = Math.max(len1, len2);
    return 1 - (matrix[len1][len2] / maxLength);
  }

  /**
   * Jaccard similarity (set-based)
   * Compares character sets or word sets
   */
  static jaccardSimilarity(str1: string, str2: string, useWords = false): number {
    if (str1 === str2) return 1.0;

    let set1: Set<string>, set2: Set<string>;

    if (useWords) {
      set1 = new Set(str1.toLowerCase().split(/\W+/).filter(w => w.length > 0));
      set2 = new Set(str2.toLowerCase().split(/\W+/).filter(w => w.length > 0));
    } else {
      set1 = new Set(str1.toLowerCase().split(''));
      set2 = new Set(str2.toLowerCase().split(''));
    }

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Cosine similarity (vector-based)
   * Creates character frequency vectors
   */
  static cosineSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;

    const text1 = str1.toLowerCase();
    const text2 = str2.toLowerCase();

    // Create character frequency maps
    const freq1: { [key: string]: number } = {};
    const freq2: { [key: string]: number } = {};

    for (const char of text1) {
      freq1[char] = (freq1[char] || 0) + 1;
    }
    for (const char of text2) {
      freq2[char] = (freq2[char] || 0) + 1;
    }

    // Get all unique characters
    const allChars = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const char of allChars) {
      const f1 = freq1[char] || 0;
      const f2 = freq2[char] || 0;
      
      dotProduct += f1 * f2;
      magnitude1 += f1 * f1;
      magnitude2 += f2 * f2;
    }

    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Jaro-Winkler similarity
   * Good for short strings and typos
   */
  static jaroWinklerSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, str2.length);

      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / str1.length + matches / str2.length + 
                  (matches - transpositions / 2) / matches) / 3;

    // Jaro-Winkler uses common prefix up to 4 characters
    let prefix = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
      if (str1[i] === str2[i]) prefix++;
      else break;
    }

    return jaro + (0.1 * prefix * (1 - jaro));
  }

  /**
   * N-gram similarity
   * Compares sequences of N characters
   */
  static nGramSimilarity(str1: string, str2: string, n = 2): number {
    if (str1 === str2) return 1.0;

    const text1 = str1.toLowerCase();
    const text2 = str2.toLowerCase();

    // Generate n-grams
    const nGrams1 = this.generateNGrams(text1, n);
    const nGrams2 = this.generateNGrams(text2, n);

    if (nGrams1.size === 0 && nGrams2.size === 0) return 1.0;
    if (nGrams1.size === 0 || nGrams2.size === 0) return 0.0;

    const intersection = new Set([...nGrams1].filter(x => nGrams2.has(x)));
    const union = new Set([...nGrams1, ...nGrams2]);

    return intersection.size / union.size;
  }

  private static generateNGrams(text: string, n: number): Set<string> {
    const nGrams = new Set<string>();
    if (text.length < n) {
      nGrams.add(text);
      return nGrams;
    }

    for (let i = 0; i <= text.length - n; i++) {
      nGrams.add(text.substring(i, i + n));
    }
    return nGrams;
  }
}

interface SimilarityConfig {
  algorithms: {
    levenshtein: { weight: number; enabled: boolean };
    jaccard: { weight: number; enabled: boolean; useWords?: boolean };
    cosine: { weight: number; enabled: boolean };
    jaroWinkler: { weight: number; enabled: boolean };
    nGram: { weight: number; enabled: boolean; n?: number };
  };
  thresholds: {
    duplicate: number;      // Fields with similarity > this are considered duplicates
    similar: number;        // Fields with similarity > this are considered similar
    cluster: number;        // Minimum similarity to group in same cluster
  };
}

interface FieldInfo {
  collection: string;
  fieldPath: string;
  dataType: string;
  sampleValues: any[];
  frequency: number;
}

interface SimilarityScore {
  field1: string;
  field2: string;
  scores: {
    levenshtein?: number;
    jaccard?: number;
    cosine?: number;
    jaroWinkler?: number;
    nGram?: number;
    combined: number;
  };
  isDuplicate: boolean;
  isSimilar: boolean;
}

interface SimilarityMatrix {
  fields: string[];
  matrix: number[][];
  scores: SimilarityScore[];
}

interface FieldCluster {
  id: number;
  fields: string[];
  averageSimilarity: number;
  recommendations: string[];
}

interface AnalysisResults {
  fieldSimilarityMatrix: SimilarityMatrix;
  valueSimilarityMatrix: SimilarityMatrix;
  duplicateFields: SimilarityScore[];
  similarFields: SimilarityScore[];
  fieldClusters: FieldCluster[];
  recommendations: string[];
  summary: {
    totalFields: number;
    duplicatePairs: number;
    similarPairs: number;
    clusters: number;
  };
}

class MultiAlgorithmSimilarityAnalyzer {
  private config: SimilarityConfig;
  private fields: FieldInfo[] = [];

  constructor(config: Partial<SimilarityConfig> = {}) {
    this.config = {
      algorithms: {
        levenshtein: { weight: 0.25, enabled: true },
        jaccard: { weight: 0.2, enabled: true, useWords: false },
        cosine: { weight: 0.2, enabled: true },
        jaroWinkler: { weight: 0.2, enabled: true },
        nGram: { weight: 0.15, enabled: true, n: 2 }
      },
      thresholds: {
        duplicate: 0.85,
        similar: 0.6,
        cluster: 0.4
      },
      ...config
    };
  }

  /**
   * Calculate combined similarity score using weighted algorithms
   */
  calculateCombinedSimilarity(str1: string, str2: string): { scores: any; combined: number } {
    const scores: any = {};
    let totalWeight = 0;
    let weightedSum = 0;

    const { algorithms } = this.config;

    if (algorithms.levenshtein.enabled) {
      scores.levenshtein = SimilarityAlgorithms.levenshteinSimilarity(str1, str2);
      weightedSum += scores.levenshtein * algorithms.levenshtein.weight;
      totalWeight += algorithms.levenshtein.weight;
    }

    if (algorithms.jaccard.enabled) {
      scores.jaccard = SimilarityAlgorithms.jaccardSimilarity(
        str1, str2, algorithms.jaccard.useWords
      );
      weightedSum += scores.jaccard * algorithms.jaccard.weight;
      totalWeight += algorithms.jaccard.weight;
    }

    if (algorithms.cosine.enabled) {
      scores.cosine = SimilarityAlgorithms.cosineSimilarity(str1, str2);
      weightedSum += scores.cosine * algorithms.cosine.weight;
      totalWeight += algorithms.cosine.weight;
    }

    if (algorithms.jaroWinkler.enabled) {
      scores.jaroWinkler = SimilarityAlgorithms.jaroWinklerSimilarity(str1, str2);
      weightedSum += scores.jaroWinkler * algorithms.jaroWinkler.weight;
      totalWeight += algorithms.jaroWinkler.weight;
    }

    if (algorithms.nGram.enabled) {
      scores.nGram = SimilarityAlgorithms.nGramSimilarity(
        str1, str2, algorithms.nGram.n || 2
      );
      weightedSum += scores.nGram * algorithms.nGram.weight;
      totalWeight += algorithms.nGram.weight;
    }

    const combined = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return { scores, combined };
  }

  /**
   * Extract all fields from MongoDB collections
   */
  async extractFields(client: MongoClient, databaseName: string): Promise<void> {
    console.log('🔍 Extracting fields from collections...');
    
    const db = client.db(databaseName);
    const collections = await db.listCollections().toArray();
    
    this.fields = [];

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`  📋 Analyzing collection: ${collectionName}`);
      
      const collection = db.collection(collectionName);
      
      // Sample documents to understand field structure
      const sampleDocs = await collection.find().limit(100).toArray();
      
      if (sampleDocs.length === 0) continue;

      // Extract field paths and analyze
      const fieldMap = new Map<string, {
        dataTypes: Set<string>;
        sampleValues: any[];
        frequency: number;
      }>();

      for (const doc of sampleDocs) {
        this.extractFieldsFromDocument(doc, '', fieldMap);
      }

      // Convert to FieldInfo objects
      for (const [fieldPath, info] of fieldMap) {
        this.fields.push({
          collection: collectionName,
          fieldPath,
          dataType: Array.from(info.dataTypes).join('|'),
          sampleValues: info.sampleValues.slice(0, 10), // Keep max 10 samples
          frequency: info.frequency / sampleDocs.length
        });
      }
    }

    console.log(`✅ Extracted ${this.fields.length} fields from ${collections.length} collections`);
  }

  private extractFieldsFromDocument(
    obj: any, 
    prefix: string, 
    fieldMap: Map<string, any>,
    depth = 0
  ): void {
    if (depth > 5) return; // Prevent infinite recursion
    
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (!fieldMap.has(fieldPath)) {
        fieldMap.set(fieldPath, {
          dataTypes: new Set<string>(),
          sampleValues: [],
          frequency: 0
        });
      }
      
      const fieldInfo = fieldMap.get(fieldPath)!;
      fieldInfo.frequency++;
      
      if (value === null || value === undefined) {
        fieldInfo.dataTypes.add('null');
      } else if (Array.isArray(value)) {
        fieldInfo.dataTypes.add('array');
        if (fieldInfo.sampleValues.length < 10) {
          fieldInfo.sampleValues.push(value);
        }
        
        // Analyze array elements if they're objects
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          for (let i = 0; i < Math.min(3, value.length); i++) {
            this.extractFieldsFromDocument(value[i], `${fieldPath}[]`, fieldMap, depth + 1);
          }
        }
      } else if (typeof value === 'object') {
        fieldInfo.dataTypes.add('object');
        this.extractFieldsFromDocument(value, fieldPath, fieldMap, depth + 1);
      } else {
        fieldInfo.dataTypes.add(typeof value);
        if (fieldInfo.sampleValues.length < 10) {
          fieldInfo.sampleValues.push(value);
        }
      }
    }
  }

  /**
   * Create similarity matrix for field names
   */
  createFieldSimilarityMatrix(): SimilarityMatrix {
    console.log('📊 Creating field similarity matrix...');
    
    const fieldNames = this.fields.map(f => `${f.collection}.${f.fieldPath}`);
    const matrix: number[][] = [];
    const scores: SimilarityScore[] = [];

    // Initialize matrix
    for (let i = 0; i < fieldNames.length; i++) {
      matrix[i] = new Array(fieldNames.length).fill(0);
    }

    // Calculate similarities
    for (let i = 0; i < fieldNames.length; i++) {
      for (let j = i + 1; j < fieldNames.length; j++) {
        const field1 = fieldNames[i];
        const field2 = fieldNames[j];
        
        // Extract just the field name (without collection prefix) for comparison
        const fieldName1 = field1.split('.').pop()!;
        const fieldName2 = field2.split('.').pop()!;
        
        const result = this.calculateCombinedSimilarity(fieldName1, fieldName2);
        
        matrix[i][j] = result.combined;
        matrix[j][i] = result.combined;

        const score: SimilarityScore = {
          field1,
          field2,
          scores: { ...result.scores, combined: result.combined },
          isDuplicate: result.combined > this.config.thresholds.duplicate,
          isSimilar: result.combined > this.config.thresholds.similar
        };

        scores.push(score);
      }
    }

    // Set diagonal to 1 (self-similarity)
    for (let i = 0; i < fieldNames.length; i++) {
      matrix[i][i] = 1.0;
    }

    return {
      fields: fieldNames,
      matrix,
      scores: scores.sort((a, b) => b.scores.combined - a.scores.combined)
    };
  }

  /**
   * Create similarity matrix for field values
   */
  createValueSimilarityMatrix(): SimilarityMatrix {
    console.log('📊 Creating value similarity matrix...');
    
    const fieldNames = this.fields.map(f => `${f.collection}.${f.fieldPath}`);
    const matrix: number[][] = [];
    const scores: SimilarityScore[] = [];

    // Initialize matrix
    for (let i = 0; i < fieldNames.length; i++) {
      matrix[i] = new Array(fieldNames.length).fill(0);
    }

    // Calculate value similarities
    for (let i = 0; i < this.fields.length; i++) {
      for (let j = i + 1; j < this.fields.length; j++) {
        const field1 = this.fields[i];
        const field2 = this.fields[j];
        
        // Compare sample values
        const valueSimilarity = this.calculateValueSimilarity(field1, field2);
        
        matrix[i][j] = valueSimilarity.combined;
        matrix[j][i] = valueSimilarity.combined;

        const score: SimilarityScore = {
          field1: fieldNames[i],
          field2: fieldNames[j],
          scores: { ...valueSimilarity.scores, combined: valueSimilarity.combined },
          isDuplicate: valueSimilarity.combined > this.config.thresholds.duplicate,
          isSimilar: valueSimilarity.combined > this.config.thresholds.similar
        };

        scores.push(score);
      }
    }

    // Set diagonal to 1 (self-similarity)
    for (let i = 0; i < this.fields.length; i++) {
      matrix[i][i] = 1.0;
    }

    return {
      fields: fieldNames,
      matrix,
      scores: scores.sort((a, b) => b.scores.combined - a.scores.combined)
    };
  }

  private calculateValueSimilarity(field1: FieldInfo, field2: FieldInfo): { scores: any; combined: number } {
    // If data types are completely different, similarity is low
    if (field1.dataType !== field2.dataType) {
      return { scores: {}, combined: 0.1 };
    }

    // Convert sample values to strings for comparison
    const values1 = field1.sampleValues.map(v => String(v)).slice(0, 5);
    const values2 = field2.sampleValues.map(v => String(v)).slice(0, 5);

    if (values1.length === 0 || values2.length === 0) {
      return { scores: {}, combined: 0.0 };
    }

    // Calculate average similarity between value sets
    let totalSimilarity = 0;
    let comparisons = 0;

    for (const val1 of values1) {
      for (const val2 of values2) {
        const result = this.calculateCombinedSimilarity(val1, val2);
        totalSimilarity += result.combined;
        comparisons++;
      }
    }

    const averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

    return {
      scores: { valueBased: averageSimilarity },
      combined: averageSimilarity
    };
  }

  /**
   * Create field clusters based on similarity
   */
  createFieldClusters(similarityMatrix: SimilarityMatrix): FieldCluster[] {
    console.log('🔗 Creating field clusters...');
    
    const clusters: FieldCluster[] = [];
    const visited = new Set<number>();
    
    for (let i = 0; i < similarityMatrix.fields.length; i++) {
      if (visited.has(i)) continue;
      
      const cluster: FieldCluster = {
        id: clusters.length,
        fields: [similarityMatrix.fields[i]],
        averageSimilarity: 0,
        recommendations: []
      };
      
      visited.add(i);
      
      // Find similar fields for this cluster
      for (let j = i + 1; j < similarityMatrix.fields.length; j++) {
        if (visited.has(j)) continue;
        
        if (similarityMatrix.matrix[i][j] > this.config.thresholds.cluster) {
          cluster.fields.push(similarityMatrix.fields[j]);
          visited.add(j);
        }
      }
      
      // Calculate average similarity within cluster
      if (cluster.fields.length > 1) {
        let totalSimilarity = 0;
        let pairs = 0;
        
        for (let x = 0; x < cluster.fields.length; x++) {
          for (let y = x + 1; y < cluster.fields.length; y++) {
            const idx1 = similarityMatrix.fields.indexOf(cluster.fields[x]);
            const idx2 = similarityMatrix.fields.indexOf(cluster.fields[y]);
            totalSimilarity += similarityMatrix.matrix[idx1][idx2];
            pairs++;
          }
        }
        
        cluster.averageSimilarity = pairs > 0 ? totalSimilarity / pairs : 0;
        
        // Generate recommendations
        cluster.recommendations = this.generateClusterRecommendations(cluster);
        
        clusters.push(cluster);
      }
    }
    
    return clusters.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
  }

  private generateClusterRecommendations(cluster: FieldCluster): string[] {
    const recommendations: string[] = [];
    
    if (cluster.averageSimilarity > 0.8) {
      recommendations.push('HIGH PRIORITY: These fields appear to be duplicates and should be consolidated');
    } else if (cluster.averageSimilarity > 0.6) {
      recommendations.push('MEDIUM PRIORITY: Consider standardizing these similar field names');
    } else {
      recommendations.push('LOW PRIORITY: These fields are somewhat related but may serve different purposes');
    }
    
    // Check for obvious naming patterns
    const fieldNames = cluster.fields.map(f => f.split('.').pop()!);
    const commonPrefixes = this.findCommonPrefixes(fieldNames);
    const commonSuffixes = this.findCommonSuffixes(fieldNames);
    
    if (commonPrefixes.length > 0) {
      recommendations.push(`Consider using consistent prefix: "${commonPrefixes[0]}"`);
    }
    if (commonSuffixes.length > 0) {
      recommendations.push(`Consider using consistent suffix: "${commonSuffixes[0]}"`);
    }
    
    return recommendations;
  }

  private findCommonPrefixes(strings: string[]): string[] {
    const prefixes = new Map<string, number>();
    
    for (const str of strings) {
      for (let i = 1; i <= Math.min(str.length, 5); i++) {
        const prefix = str.substring(0, i);
        prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
      }
    }
    
    return Array.from(prefixes.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([prefix]) => prefix);
  }

  private findCommonSuffixes(strings: string[]): string[] {
    const suffixes = new Map<string, number>();
    
    for (const str of strings) {
      for (let i = 1; i <= Math.min(str.length, 5); i++) {
        const suffix = str.substring(str.length - i);
        suffixes.set(suffix, (suffixes.get(suffix) || 0) + 1);
      }
    }
    
    return Array.from(suffixes.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([suffix]) => suffix);
  }

  /**
   * Generate comprehensive recommendations
   */
  generateRecommendations(results: AnalysisResults): string[] {
    const recommendations: string[] = [];
    
    // High-priority duplicates
    if (results.duplicateFields.length > 0) {
      recommendations.push('🚨 CRITICAL: Found potential duplicate fields that should be consolidated:');
      results.duplicateFields.slice(0, 5).forEach(dup => {
        recommendations.push(`   • ${dup.field1} ↔ ${dup.field2} (similarity: ${(dup.scores.combined * 100).toFixed(1)}%)`);
      });
    }
    
    // Field standardization
    if (results.similarFields.length > 5) {
      recommendations.push('📝 Consider implementing field naming standards to reduce confusion');
    }
    
    // Clustering insights
    if (results.fieldClusters.length > 0) {
      recommendations.push(`🔗 Found ${results.fieldClusters.length} field clusters that could be standardized`);
      
      const highPriorityClusters = results.fieldClusters.filter(c => c.averageSimilarity > 0.7);
      if (highPriorityClusters.length > 0) {
        recommendations.push('   High priority clusters for review:');
        highPriorityClusters.slice(0, 3).forEach(cluster => {
          recommendations.push(`   • Cluster ${cluster.id}: ${cluster.fields.length} fields (${(cluster.averageSimilarity * 100).toFixed(1)}% similarity)`);
        });
      }
    }
    
    // Data quality insights
    const collectionsWithDuplicates = new Set(
      results.duplicateFields.map(d => d.field1.split('.')[0])
    );
    if (collectionsWithDuplicates.size > 0) {
      recommendations.push(`📊 Collections with potential field duplicates: ${Array.from(collectionsWithDuplicates).join(', ')}`);
    }
    
    return recommendations;
  }

  /**
   * Run complete similarity analysis
   */
  async analyze(client: MongoClient, databaseName: string): Promise<AnalysisResults> {
    console.log('🚀 Starting multi-algorithm similarity analysis...');
    
    // Extract fields from all collections
    await this.extractFields(client, databaseName);
    
    // Create similarity matrices
    const fieldSimilarityMatrix = this.createFieldSimilarityMatrix();
    const valueSimilarityMatrix = this.createValueSimilarityMatrix();
    
    // Extract duplicate and similar fields
    const duplicateFields = fieldSimilarityMatrix.scores.filter(s => s.isDuplicate);
    const similarFields = fieldSimilarityMatrix.scores.filter(s => s.isSimilar && !s.isDuplicate);
    
    // Create field clusters
    const fieldClusters = this.createFieldClusters(fieldSimilarityMatrix);
    
    const results: AnalysisResults = {
      fieldSimilarityMatrix,
      valueSimilarityMatrix,
      duplicateFields,
      similarFields,
      fieldClusters,
      recommendations: [],
      summary: {
        totalFields: this.fields.length,
        duplicatePairs: duplicateFields.length,
        similarPairs: similarFields.length,
        clusters: fieldClusters.length
      }
    };
    
    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);
    
    console.log('✅ Similarity analysis complete!');
    return results;
  }

  /**
   * Save results to files
   */
  async saveResults(results: AnalysisResults, outputDir: string): Promise<void> {
    console.log('💾 Saving analysis results...');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON results
    const jsonPath = path.join(outputDir, `similarity-analysis-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    
    // Save markdown report
    const markdownPath = path.join(outputDir, `similarity-report-${timestamp}.md`);
    const markdownContent = this.generateMarkdownReport(results);
    fs.writeFileSync(markdownPath, markdownContent);
    
    // Save CSV for easy analysis
    const csvPath = path.join(outputDir, `similarity-scores-${timestamp}.csv`);
    const csvContent = this.generateCSVReport(results);
    fs.writeFileSync(csvPath, csvContent);
    
    console.log(`✅ Results saved to:`);
    console.log(`   📄 JSON: ${jsonPath}`);
    console.log(`   📝 Report: ${markdownPath}`);
    console.log(`   📊 CSV: ${csvPath}`);
  }

  private generateMarkdownReport(results: AnalysisResults): string {
    const { summary, duplicateFields, similarFields, fieldClusters, recommendations } = results;
    
    let markdown = `# Multi-Algorithm Similarity Analysis Report\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Summary
    markdown += `## 📊 Summary\n\n`;
    markdown += `- **Total Fields Analyzed**: ${summary.totalFields}\n`;
    markdown += `- **Potential Duplicates**: ${summary.duplicatePairs}\n`;
    markdown += `- **Similar Fields**: ${summary.similarPairs}\n`;
    markdown += `- **Field Clusters**: ${summary.clusters}\n\n`;
    
    // Configuration
    markdown += `## ⚙️ Configuration\n\n`;
    markdown += `**Similarity Algorithms Used**:\n`;
    Object.entries(this.config.algorithms).forEach(([name, config]) => {
      if (config.enabled) {
        markdown += `- ${name}: weight ${config.weight}\n`;
      }
    });
    markdown += `\n**Thresholds**:\n`;
    markdown += `- Duplicate: ${this.config.thresholds.duplicate}\n`;
    markdown += `- Similar: ${this.config.thresholds.similar}\n`;
    markdown += `- Cluster: ${this.config.thresholds.cluster}\n\n`;
    
    // Recommendations
    markdown += `## 🎯 Recommendations\n\n`;
    recommendations.forEach(rec => {
      markdown += `${rec}\n\n`;
    });
    
    // Duplicate Fields
    if (duplicateFields.length > 0) {
      markdown += `## 🚨 Potential Duplicate Fields\n\n`;
      markdown += `| Field 1 | Field 2 | Similarity | Levenshtein | Jaccard | Cosine | Jaro-Winkler | N-Gram |\n`;
      markdown += `|---------|---------|------------|-------------|---------|--------|--------------|--------|\n`;
      
      duplicateFields.slice(0, 20).forEach(dup => {
        const scores = dup.scores;
        markdown += `| ${dup.field1} | ${dup.field2} | ${(scores.combined * 100).toFixed(1)}% |`;
        markdown += ` ${scores.levenshtein ? (scores.levenshtein * 100).toFixed(1) + '%' : 'N/A'} |`;
        markdown += ` ${scores.jaccard ? (scores.jaccard * 100).toFixed(1) + '%' : 'N/A'} |`;
        markdown += ` ${scores.cosine ? (scores.cosine * 100).toFixed(1) + '%' : 'N/A'} |`;
        markdown += ` ${scores.jaroWinkler ? (scores.jaroWinkler * 100).toFixed(1) + '%' : 'N/A'} |`;
        markdown += ` ${scores.nGram ? (scores.nGram * 100).toFixed(1) + '%' : 'N/A'} |\n`;
      });
      markdown += `\n`;
    }
    
    // Field Clusters
    if (fieldClusters.length > 0) {
      markdown += `## 🔗 Field Clusters\n\n`;
      
      fieldClusters.slice(0, 10).forEach((cluster, index) => {
        markdown += `### Cluster ${cluster.id} (${(cluster.averageSimilarity * 100).toFixed(1)}% similarity)\n\n`;
        markdown += `**Fields:**\n`;
        cluster.fields.forEach(field => {
          markdown += `- ${field}\n`;
        });
        markdown += `\n**Recommendations:**\n`;
        cluster.recommendations.forEach(rec => {
          markdown += `- ${rec}\n`;
        });
        markdown += `\n`;
      });
    }
    
    // Top Similar Fields
    if (similarFields.length > 0) {
      markdown += `## 🔍 Top Similar Fields (Non-Duplicates)\n\n`;
      markdown += `| Field 1 | Field 2 | Similarity Score |\n`;
      markdown += `|---------|---------|------------------|\n`;
      
      similarFields.slice(0, 15).forEach(sim => {
        markdown += `| ${sim.field1} | ${sim.field2} | ${(sim.scores.combined * 100).toFixed(1)}% |\n`;
      });
      markdown += `\n`;
    }
    
    return markdown;
  }

  private generateCSVReport(results: AnalysisResults): string {
    const { fieldSimilarityMatrix } = results;
    
    let csv = 'Field1,Field2,Combined,Levenshtein,Jaccard,Cosine,JaroWinkler,NGram,IsDuplicate,IsSimilar\n';
    
    fieldSimilarityMatrix.scores.forEach(score => {
      const scores = score.scores;
      csv += `"${score.field1}","${score.field2}",`;
      csv += `${scores.combined.toFixed(4)},`;
      csv += `${scores.levenshtein?.toFixed(4) || ''},`;
      csv += `${scores.jaccard?.toFixed(4) || ''},`;
      csv += `${scores.cosine?.toFixed(4) || ''},`;
      csv += `${scores.jaroWinkler?.toFixed(4) || ''},`;
      csv += `${scores.nGram?.toFixed(4) || ''},`;
      csv += `${score.isDuplicate},${score.isSimilar}\n`;
    });
    
    return csv;
  }
}

// Main execution
async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const databaseName = process.env.DATABASE_NAME || 'test';
  const outputDir = './similarity-analysis-results';
  
  console.log('🚀 Multi-Algorithm Similarity Analysis');
  console.log(`📍 Database: ${databaseName}`);
  console.log(`📁 Output Directory: ${outputDir}`);
  console.log('━'.repeat(50));
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    // Create analyzer with custom configuration
    const analyzer = new MultiAlgorithmSimilarityAnalyzer({
      algorithms: {
        levenshtein: { weight: 0.3, enabled: true },
        jaccard: { weight: 0.25, enabled: true, useWords: false },
        cosine: { weight: 0.2, enabled: true },
        jaroWinkler: { weight: 0.15, enabled: true },
        nGram: { weight: 0.1, enabled: true, n: 2 }
      },
      thresholds: {
        duplicate: 0.85,
        similar: 0.6,
        cluster: 0.4
      }
    });
    
    // Run analysis
    const results = await analyzer.analyze(client, databaseName);
    
    // Display summary
    console.log('\n📊 ANALYSIS COMPLETE');
    console.log('━'.repeat(50));
    console.log(`Total fields analyzed: ${results.summary.totalFields}`);
    console.log(`Potential duplicates: ${results.summary.duplicatePairs}`);
    console.log(`Similar fields: ${results.summary.similarPairs}`);
    console.log(`Field clusters: ${results.summary.clusters}`);
    
    if (results.recommendations.length > 0) {
      console.log('\n🎯 KEY RECOMMENDATIONS:');
      results.recommendations.slice(0, 5).forEach(rec => {
        console.log(`${rec}`);
      });
    }
    
    // Save results
    await analyzer.saveResults(results, outputDir);
    
    console.log('\n✅ Analysis complete! Check the output files for detailed results.');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { MultiAlgorithmSimilarityAnalyzer, SimilarityAlgorithms };