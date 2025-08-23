import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface AnalysisResult {
  timestamp: string;
  type: string;
  data: any;
  summary: any;
}

interface ComprehensiveReport {
  executiveSummary: {
    totalCollections: number;
    totalDocuments: number;
    schemaComplexity: number;
    dataQualityScore: number;
    criticalIssues: number;
    complianceScore: number;
  };
  schemaAnalysis: {
    collections: any[];
    fieldDistribution: any;
    complexityMetrics: any;
  };
  fieldConsistency: {
    exactMatches: any[];
    inconsistencies: any[];
    recommendations: string[];
  };
  valuePatternAnalysis: {
    patterns: any[];
    anomalies: any[];
    qualityMetrics: any;
  };
  similarityAnalysis: {
    fieldSimilarity: any[];
    valueSimilarity: any[];
    multiAlgorithmResults: any;
  };
  dataClassification: {
    fieldTypes: any;
    valueClassification: any;
    sensitiveData: any[];
  };
  topIssues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    description: string;
    impact: string;
    recommendation: string;
    priority: number;
  }>;
  actionPlan: Array<{
    task: string;
    priority: 'immediate' | 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    timeline: string;
  }>;
}

class ComprehensiveAnalysisReportGenerator {
  private client: MongoClient;
  private db: Db;
  private reportDir: string;

  constructor() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/supabase';
    this.client = new MongoClient(mongoUri);
    this.reportDir = path.join(__dirname, '../comprehensive-reports');
    this.ensureReportDirectory();
  }

  private ensureReportDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db('supabase');
    console.log('Connected to MongoDB database');
  }

  async disconnect() {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private async loadPreviousAnalyses(): Promise<AnalysisResult[]> {
    const analyses: AnalysisResult[] = [];
    const analysisDir = path.join(__dirname, '../analysis-results');
    
    if (fs.existsSync(analysisDir)) {
      const files = fs.readdirSync(analysisDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(analysisDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            
            analyses.push({
              timestamp: data.timestamp || new Date().toISOString(),
              type: this.inferAnalysisType(file),
              data: data,
              summary: data.summary || {}
            });
          } catch (error) {
            console.warn(`Failed to load analysis file ${file}:`, error);
          }
        }
      }
    }

    return analyses;
  }

  private inferAnalysisType(filename: string): string {
    if (filename.includes('decomposition')) return 'schema-decomposition';
    if (filename.includes('field-consistency')) return 'field-consistency';
    if (filename.includes('value-pattern')) return 'value-pattern';
    if (filename.includes('similarity')) return 'similarity-analysis';
    if (filename.includes('classification')) return 'data-classification';
    return 'unknown';
  }

  private async getCollectionStats() {
    const collections = await this.db.listCollections().toArray();
    const stats = [];

    for (const collection of collections) {
      const collectionName = collection.name;
      const collStats = await this.db.command({ collStats: collectionName });
      const documentCount = await this.db.collection(collectionName).countDocuments();
      
      stats.push({
        name: collectionName,
        documentCount,
        avgObjSize: collStats.avgObjSize,
        storageSize: collStats.storageSize,
        totalIndexSize: collStats.totalIndexSize
      });
    }

    return stats;
  }

  private calculateDataQualityScore(analyses: AnalysisResult[]): number {
    let score = 100;
    
    // Deduct points for various issues
    const fieldConsistency = analyses.find(a => a.type === 'field-consistency');
    if (fieldConsistency?.data?.inconsistencies) {
      score -= Math.min(fieldConsistency.data.inconsistencies.length * 2, 20);
    }

    const valuePattern = analyses.find(a => a.type === 'value-pattern');
    if (valuePattern?.data?.anomalies) {
      score -= Math.min(valuePattern.data.anomalies.length * 1.5, 15);
    }

    return Math.max(score, 0);
  }

  private identifyTopIssues(analyses: AnalysisResult[]): ComprehensiveReport['topIssues'] {
    const issues: ComprehensiveReport['topIssues'] = [];

    // Schema issues
    const schemaAnalysis = analyses.find(a => a.type === 'schema-decomposition');
    if (schemaAnalysis?.data?.complexCollections) {
      schemaAnalysis.data.complexCollections.forEach((collection: any) => {
        if (collection.complexity > 50) {
          issues.push({
            severity: 'high',
            category: 'Schema Complexity',
            description: `Collection "${collection.name}" has high schema complexity (${collection.complexity})`,
            impact: 'Performance degradation, maintenance difficulties',
            recommendation: 'Consider schema normalization or restructuring',
            priority: 8
          });
        }
      });
    }

    // Field consistency issues
    const fieldConsistency = analyses.find(a => a.type === 'field-consistency');
    if (fieldConsistency?.data?.inconsistencies) {
      fieldConsistency.data.inconsistencies.forEach((inconsistency: any) => {
        issues.push({
          severity: 'medium',
          category: 'Data Consistency',
          description: `Field naming inconsistency: ${inconsistency.description}`,
          impact: 'Query complexity, data integration issues',
          recommendation: 'Standardize field naming conventions',
          priority: 6
        });
      });
    }

    // Value pattern anomalies
    const valuePattern = analyses.find(a => a.type === 'value-pattern');
    if (valuePattern?.data?.anomalies) {
      valuePattern.data.anomalies.forEach((anomaly: any) => {
        issues.push({
          severity: anomaly.severity === 'high' ? 'critical' : 'medium',
          category: 'Data Quality',
          description: anomaly.description,
          impact: 'Data integrity issues, potential application errors',
          recommendation: 'Implement data validation and cleansing',
          priority: anomaly.severity === 'high' ? 9 : 5
        });
      });
    }

    // Sort by priority
    return issues.sort((a, b) => b.priority - a.priority).slice(0, 10);
  }

  private generateActionPlan(issues: ComprehensiveReport['topIssues']): ComprehensiveReport['actionPlan'] {
    const actionPlan: ComprehensiveReport['actionPlan'] = [];

    // Critical issues - immediate action
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    criticalIssues.forEach(issue => {
      actionPlan.push({
        task: `Address critical issue: ${issue.description}`,
        priority: 'immediate',
        effort: 'high',
        impact: 'high',
        timeline: '1-2 days'
      });
    });

    // High severity issues
    const highIssues = issues.filter(issue => issue.severity === 'high');
    highIssues.forEach(issue => {
      actionPlan.push({
        task: `Resolve: ${issue.description}`,
        priority: 'high',
        effort: 'medium',
        impact: 'high',
        timeline: '1 week'
      });
    });

    // Standard improvements
    actionPlan.push({
      task: 'Implement automated data quality monitoring',
      priority: 'medium',
      effort: 'medium',
      impact: 'high',
      timeline: '2-3 weeks'
    });

    actionPlan.push({
      task: 'Standardize field naming conventions',
      priority: 'medium',
      effort: 'high',
      impact: 'medium',
      timeline: '1 month'
    });

    actionPlan.push({
      task: 'Optimize complex schema structures',
      priority: 'low',
      effort: 'high',
      impact: 'medium',
      timeline: '2 months'
    });

    return actionPlan;
  }

  private generateSimilarityMatrix(analyses: AnalysisResult[]): any {
    const similarityAnalysis = analyses.find(a => a.type === 'similarity-analysis');
    if (!similarityAnalysis) return null;

    const matrix = {};
    if (similarityAnalysis.data?.fieldSimilarity) {
      similarityAnalysis.data.fieldSimilarity.forEach((item: any) => {
        const key = `${item.collection1}-${item.collection2}`;
        matrix[key] = {
          fieldSimilarity: item.similarity,
          commonFields: item.commonFields || [],
          uniqueFields1: item.uniqueFields1 || [],
          uniqueFields2: item.uniqueFields2 || []
        };
      });
    }

    return matrix;
  }

  private async generateComprehensiveReport(): Promise<ComprehensiveReport> {
    const analyses = await this.loadPreviousAnalyses();
    const collectionStats = await this.getCollectionStats();
    const topIssues = this.identifyTopIssues(analyses);

    const report: ComprehensiveReport = {
      executiveSummary: {
        totalCollections: collectionStats.length,
        totalDocuments: collectionStats.reduce((sum, stat) => sum + stat.documentCount, 0),
        schemaComplexity: this.calculateSchemaComplexity(analyses),
        dataQualityScore: this.calculateDataQualityScore(analyses),
        criticalIssues: topIssues.filter(issue => issue.severity === 'critical').length,
        complianceScore: this.calculateComplianceScore(analyses)
      },
      schemaAnalysis: {
        collections: collectionStats,
        fieldDistribution: this.extractFieldDistribution(analyses),
        complexityMetrics: this.extractComplexityMetrics(analyses)
      },
      fieldConsistency: this.extractFieldConsistency(analyses),
      valuePatternAnalysis: this.extractValuePatternAnalysis(analyses),
      similarityAnalysis: {
        fieldSimilarity: this.extractFieldSimilarity(analyses),
        valueSimilarity: this.extractValueSimilarity(analyses),
        multiAlgorithmResults: this.extractMultiAlgorithmResults(analyses)
      },
      dataClassification: this.extractDataClassification(analyses),
      topIssues,
      actionPlan: this.generateActionPlan(topIssues)
    };

    return report;
  }

  private calculateSchemaComplexity(analyses: AnalysisResult[]): number {
    const schemaAnalysis = analyses.find(a => a.type === 'schema-decomposition');
    if (!schemaAnalysis?.data?.collections) return 0;

    const complexities = schemaAnalysis.data.collections.map((c: any) => c.complexity || 0);
    return complexities.reduce((sum: number, complexity: number) => sum + complexity, 0) / complexities.length;
  }

  private calculateComplianceScore(analyses: AnalysisResult[]): number {
    // Simple compliance score based on data classification and consistency
    const classification = analyses.find(a => a.type === 'data-classification');
    const consistency = analyses.find(a => a.type === 'field-consistency');
    
    let score = 100;
    
    if (classification?.data?.sensitiveData?.length > 0) {
      score -= classification.data.sensitiveData.length * 5;
    }
    
    if (consistency?.data?.inconsistencies?.length > 0) {
      score -= consistency.data.inconsistencies.length * 2;
    }
    
    return Math.max(score, 0);
  }

  private extractFieldDistribution(analyses: AnalysisResult[]): any {
    const schemaAnalysis = analyses.find(a => a.type === 'schema-decomposition');
    return schemaAnalysis?.data?.fieldDistribution || {};
  }

  private extractComplexityMetrics(analyses: AnalysisResult[]): any {
    const schemaAnalysis = analyses.find(a => a.type === 'schema-decomposition');
    return schemaAnalysis?.data?.complexityMetrics || {};
  }

  private extractFieldConsistency(analyses: AnalysisResult[]): any {
    const fieldConsistency = analyses.find(a => a.type === 'field-consistency');
    return {
      exactMatches: fieldConsistency?.data?.exactMatches || [],
      inconsistencies: fieldConsistency?.data?.inconsistencies || [],
      recommendations: fieldConsistency?.data?.recommendations || []
    };
  }

  private extractValuePatternAnalysis(analyses: AnalysisResult[]): any {
    const valuePattern = analyses.find(a => a.type === 'value-pattern');
    return {
      patterns: valuePattern?.data?.patterns || [],
      anomalies: valuePattern?.data?.anomalies || [],
      qualityMetrics: valuePattern?.data?.qualityMetrics || {}
    };
  }

  private extractFieldSimilarity(analyses: AnalysisResult[]): any[] {
    const similarityAnalysis = analyses.find(a => a.type === 'similarity-analysis');
    return similarityAnalysis?.data?.fieldSimilarity || [];
  }

  private extractValueSimilarity(analyses: AnalysisResult[]): any[] {
    const similarityAnalysis = analyses.find(a => a.type === 'similarity-analysis');
    return similarityAnalysis?.data?.valueSimilarity || [];
  }

  private extractMultiAlgorithmResults(analyses: AnalysisResult[]): any {
    const similarityAnalysis = analyses.find(a => a.type === 'similarity-analysis');
    return similarityAnalysis?.data?.multiAlgorithmResults || {};
  }

  private extractDataClassification(analyses: AnalysisResult[]): any {
    const classification = analyses.find(a => a.type === 'data-classification');
    return {
      fieldTypes: classification?.data?.fieldTypes || {},
      valueClassification: classification?.data?.valueClassification || {},
      sensitiveData: classification?.data?.sensitiveData || []
    };
  }

  private generateHTMLReport(report: ComprehensiveReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Data Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #333; margin-top: 30px; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; border-left: 4px solid #3498db; padding-left: 15px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #3498db; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; font-size: 0.9em; margin-top: 5px; }
        .issue { margin: 15px 0; padding: 15px; border-radius: 5px; }
        .issue.critical { background-color: #ffebee; border-left: 4px solid #f44336; }
        .issue.high { background-color: #fff3e0; border-left: 4px solid #ff9800; }
        .issue.medium { background-color: #f3e5f5; border-left: 4px solid #9c27b0; }
        .issue.low { background-color: #e8f5e8; border-left: 4px solid #4caf50; }
        .action-item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; }
        .priority-immediate { border-left-color: #dc3545 !important; }
        .priority-high { border-left-color: #fd7e14 !important; }
        .priority-medium { border-left-color: #ffc107 !important; }
        .priority-low { border-left-color: #28a745 !important; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .score { font-weight: bold; padding: 5px 10px; border-radius: 3px; }
        .score.excellent { background-color: #d4edda; color: #155724; }
        .score.good { background-color: #cce7ff; color: #004085; }
        .score.fair { background-color: #fff3cd; color: #856404; }
        .score.poor { background-color: #f8d7da; color: #721c24; }
        .chart-placeholder { background: #f8f9fa; height: 300px; border: 2px dashed #dee2e6; display: flex; align-items: center; justify-content: center; color: #6c757d; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Comprehensive Data Analysis Report</h1>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        
        <h2>Executive Summary</h2>
        <div class="summary-grid">
            <div class="metric-card">
                <div class="metric-value">${report.executiveSummary.totalCollections}</div>
                <div class="metric-label">Total Collections</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.executiveSummary.totalDocuments.toLocaleString()}</div>
                <div class="metric-label">Total Documents</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.executiveSummary.dataQualityScore.toFixed(1)}</div>
                <div class="metric-label">Data Quality Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.executiveSummary.criticalIssues}</div>
                <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.executiveSummary.complianceScore.toFixed(1)}</div>
                <div class="metric-label">Compliance Score</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.executiveSummary.schemaComplexity.toFixed(1)}</div>
                <div class="metric-label">Schema Complexity</div>
            </div>
        </div>

        <h2>Top Issues & Risks</h2>
        ${report.topIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <h3>${issue.category} - ${issue.severity.toUpperCase()}</h3>
                <p><strong>Description:</strong> ${issue.description}</p>
                <p><strong>Impact:</strong> ${issue.impact}</p>
                <p><strong>Recommendation:</strong> ${issue.recommendation}</p>
                <p><strong>Priority Score:</strong> ${issue.priority}/10</p>
            </div>
        `).join('')}

        <h2>Action Plan</h2>
        ${report.actionPlan.map(action => `
            <div class="action-item priority-${action.priority}">
                <h3>${action.task}</h3>
                <p><strong>Priority:</strong> ${action.priority.toUpperCase()}</p>
                <p><strong>Effort:</strong> ${action.effort} | <strong>Impact:</strong> ${action.impact}</p>
                <p><strong>Timeline:</strong> ${action.timeline}</p>
            </div>
        `).join('')}

        <h2>Schema Analysis</h2>
        <table>
            <thead>
                <tr>
                    <th>Collection</th>
                    <th>Document Count</th>
                    <th>Avg Object Size</th>
                    <th>Storage Size</th>
                    <th>Index Size</th>
                </tr>
            </thead>
            <tbody>
                ${report.schemaAnalysis.collections.map(collection => `
                    <tr>
                        <td>${collection.name}</td>
                        <td>${collection.documentCount.toLocaleString()}</td>
                        <td>${(collection.avgObjSize / 1024).toFixed(2)} KB</td>
                        <td>${(collection.storageSize / 1024 / 1024).toFixed(2)} MB</td>
                        <td>${(collection.totalIndexSize / 1024).toFixed(2)} KB</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>Field Consistency Analysis</h2>
        <h3>Field Inconsistencies (${report.fieldConsistency.inconsistencies.length})</h3>
        ${report.fieldConsistency.inconsistencies.slice(0, 10).map(inconsistency => `
            <div class="issue medium">
                <p><strong>Issue:</strong> ${inconsistency.description || inconsistency}</p>
            </div>
        `).join('')}

        <h2>Data Quality Patterns</h2>
        <div class="chart-placeholder">
            Value Pattern Analysis Visualization
            <br>
            Anomalies: ${report.valuePatternAnalysis.anomalies.length}
            <br>
            Patterns: ${report.valuePatternAnalysis.patterns.length}
        </div>

        <h2>Similarity Analysis</h2>
        <div class="chart-placeholder">
            Field Similarity Matrix
            <br>
            ${report.similarityAnalysis.fieldSimilarity.length} similarity comparisons
        </div>

        <h2>Data Classification Results</h2>
        <p><strong>Sensitive Data Fields Detected:</strong> ${report.dataClassification.sensitiveData.length}</p>
        ${report.dataClassification.sensitiveData.slice(0, 5).map(sensitive => `
            <div class="issue high">
                <p><strong>Field:</strong> ${sensitive.field || sensitive}</p>
                <p><strong>Type:</strong> ${sensitive.type || 'Unknown'}</p>
                <p><strong>Collection:</strong> ${sensitive.collection || 'Unknown'}</p>
            </div>
        `).join('')}

        <h2>Recommendations Summary</h2>
        <ul>
            ${report.fieldConsistency.recommendations.slice(0, 5).map(rec => `<li>${rec}</li>`).join('')}
            <li>Implement automated data quality monitoring</li>
            <li>Establish data governance policies</li>
            <li>Regular schema validation and cleanup</li>
            <li>Implement data classification tagging</li>
        </ul>

        <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; text-align: center;">
            <p>Report generated by Comprehensive Analysis System | ${new Date().toLocaleDateString()}</p>
        </footer>
    </div>
</body>
</html>`;
  }

  private async saveSimilarityMatrices(report: ComprehensiveReport) {
    // Field Similarity Matrix CSV
    if (report.similarityAnalysis.fieldSimilarity.length > 0) {
      const fieldSimilarityCSV = [
        'Collection1,Collection2,Similarity Score,Common Fields,Unique Fields 1,Unique Fields 2'
      ];
      
      report.similarityAnalysis.fieldSimilarity.forEach((item: any) => {
        fieldSimilarityCSV.push([
          item.collection1 || '',
          item.collection2 || '',
          item.similarity || 0,
          (item.commonFields || []).join(';'),
          (item.uniqueFields1 || []).join(';'),
          (item.uniqueFields2 || []).join(';')
        ].join(','));
      });

      fs.writeFileSync(
        path.join(this.reportDir, 'field-similarity-matrix.csv'),
        fieldSimilarityCSV.join('\n')
      );
    }

    // Value Similarity Matrix CSV
    if (report.similarityAnalysis.valueSimilarity.length > 0) {
      const valueSimilarityCSV = [
        'Collection1,Collection2,Field,Similarity Score,Sample Values'
      ];
      
      report.similarityAnalysis.valueSimilarity.forEach((item: any) => {
        valueSimilarityCSV.push([
          item.collection1 || '',
          item.collection2 || '',
          item.field || '',
          item.similarity || 0,
          (item.sampleValues || []).join(';')
        ].join(','));
      });

      fs.writeFileSync(
        path.join(this.reportDir, 'value-similarity-matrix.csv'),
        valueSimilarityCSV.join('\n')
      );
    }
  }

  async generateReport() {
    try {
      console.log('🚀 Starting comprehensive analysis report generation...');
      
      await this.connect();
      
      // Generate comprehensive report
      console.log('📊 Generating comprehensive report...');
      const report = await this.generateComprehensiveReport();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save JSON report
      const jsonPath = path.join(this.reportDir, `comprehensive-report-${timestamp}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
      console.log(`✅ JSON report saved: ${jsonPath}`);
      
      // Generate HTML report
      console.log('🌐 Generating HTML report...');
      const htmlContent = this.generateHTMLReport(report);
      const htmlPath = path.join(this.reportDir, `comprehensive-report-${timestamp}.html`);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`✅ HTML report saved: ${htmlPath}`);
      
      // Save similarity matrices
      console.log('📈 Saving similarity matrices...');
      await this.saveSimilarityMatrices(report);
      console.log('✅ Similarity matrices saved as CSV files');
      
      // Generate executive summary
      const executiveSummary = {
        reportDate: new Date().toISOString(),
        keyMetrics: report.executiveSummary,
        criticalFindings: report.topIssues.filter(issue => issue.severity === 'critical'),
        immediateActions: report.actionPlan.filter(action => action.priority === 'immediate'),
        dataQualityAssessment: {
          score: report.executiveSummary.dataQualityScore,
          rating: report.executiveSummary.dataQualityScore >= 90 ? 'Excellent' :
                  report.executiveSummary.dataQualityScore >= 75 ? 'Good' :
                  report.executiveSummary.dataQualityScore >= 60 ? 'Fair' : 'Poor',
          mainIssues: report.topIssues.slice(0, 5).map(issue => issue.description)
        },
        recommendations: [
          'Implement automated data quality monitoring',
          'Address critical schema inconsistencies',
          'Establish data governance framework',
          'Regular data validation and cleansing',
          'Standardize field naming conventions'
        ]
      };
      
      const summaryPath = path.join(this.reportDir, `executive-summary-${timestamp}.json`);
      fs.writeFileSync(summaryPath, JSON.stringify(executiveSummary, null, 2));
      console.log(`✅ Executive summary saved: ${summaryPath}`);
      
      // Print summary to console
      console.log('\n' + '='.repeat(80));
      console.log('📋 COMPREHENSIVE ANALYSIS REPORT SUMMARY');
      console.log('='.repeat(80));
      console.log(`📊 Total Collections: ${report.executiveSummary.totalCollections}`);
      console.log(`📄 Total Documents: ${report.executiveSummary.totalDocuments.toLocaleString()}`);
      console.log(`⭐ Data Quality Score: ${report.executiveSummary.dataQualityScore.toFixed(1)}/100`);
      console.log(`🔍 Schema Complexity: ${report.executiveSummary.schemaComplexity.toFixed(1)}`);
      console.log(`🛡️ Compliance Score: ${report.executiveSummary.complianceScore.toFixed(1)}/100`);
      console.log(`⚠️ Critical Issues: ${report.executiveSummary.criticalIssues}`);
      console.log(`📋 Total Issues: ${report.topIssues.length}`);
      console.log(`🎯 Action Items: ${report.actionPlan.length}`);
      
      console.log('\n🔥 TOP CRITICAL ISSUES:');
      report.topIssues.filter(issue => issue.severity === 'critical').slice(0, 3).forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.description}`);
      });
      
      console.log('\n🎯 IMMEDIATE ACTION REQUIRED:');
      report.actionPlan.filter(action => action.priority === 'immediate').slice(0, 3).forEach((action, index) => {
        console.log(`${index + 1}. ${action.task} (${action.timeline})`);
      });
      
      console.log('\n📁 GENERATED FILES:');
      console.log(`• JSON Report: ${path.basename(jsonPath)}`);
      console.log(`• HTML Report: ${path.basename(htmlPath)}`);
      console.log(`• Executive Summary: ${path.basename(summaryPath)}`);
      console.log('• Field Similarity Matrix: field-similarity-matrix.csv');
      console.log('• Value Similarity Matrix: value-similarity-matrix.csv');
      
      console.log('\n✨ Report generation completed successfully!');
      console.log(`📂 All files saved in: ${this.reportDir}`);
      
    } catch (error) {
      console.error('❌ Error generating comprehensive report:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const generator = new ComprehensiveAnalysisReportGenerator();
  generator.generateReport().catch(console.error);
}

export default ComprehensiveAnalysisReportGenerator;