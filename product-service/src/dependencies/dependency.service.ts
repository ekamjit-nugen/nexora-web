import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IDependencyGraph, IDependency, IImpactAnalysis } from './dependency.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DependencyService {
  constructor(@InjectModel('DependencyGraph') private graphModel: Model<IDependencyGraph>) {}

  /**
   * Get or create dependency graph
   */
  async getGraph(productId: string): Promise<IDependencyGraph> {
    let graph = await this.graphModel.findOne({ productId });

    if (!graph) {
      graph = new this.graphModel({
        productId,
        dependencies: [],
        impactAnalyses: [],
      });
      await graph.save();
    }

    return graph;
  }

  /**
   * Add dependency
   */
  async addDependency(
    productId: string,
    dependency: Omit<IDependency, 'id' | 'createdAt'>,
  ): Promise<IDependencyGraph> {
    const graph = await this.getGraph(productId);

    // Prevent circular dependencies
    if (dependency.sourceProductId === dependency.targetProductId) {
      throw new BadRequestException('Cannot create self-referencing dependency');
    }

    const newDependency: IDependency = {
      id: uuidv4(),
      createdAt: new Date(),
      ...dependency,
    };

    graph.dependencies.push(newDependency);
    return graph.save();
  }

  /**
   * Remove dependency
   */
  async removeDependency(productId: string, dependencyId: string): Promise<IDependencyGraph> {
    const graph = await this.getGraph(productId);

    graph.dependencies = graph.dependencies.filter(d => d.id !== dependencyId);
    return graph.save();
  }

  /**
   * Analyze impact
   */
  async analyzeImpact(productId: string, sourceProductId: string): Promise<IImpactAnalysis> {
    const graph = await this.getGraph(productId);

    // Find all affected products
    const affectedProducts = this.findAffectedProducts(graph.dependencies, sourceProductId);

    // Calculate risk level based on number of affected products
    const riskLevel = this.calculateRiskLevel(affectedProducts.length);

    const analysis: IImpactAnalysis = {
      sourceProductId,
      affectedProducts,
      riskLevel,
      estimatedImpact: affectedProducts.length,
      mitigation: this.generateMitigation(affectedProducts),
    };

    graph.impactAnalyses.push(analysis);
    graph.lastAnalyzedAt = new Date();
    await graph.save();

    return analysis;
  }

  /**
   * Find affected products
   */
  private findAffectedProducts(dependencies: IDependency[], sourceProductId: string): string[] {
    const affected = new Set<string>();
    const queue = [sourceProductId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;

      visited.add(current);

      const directDependents = dependencies
        .filter(d => d.sourceProductId === current && d.type === 'impacts')
        .map(d => d.targetProductId);

      directDependents.forEach(dep => {
        affected.add(dep);
        queue.push(dep);
      });
    }

    return Array.from(affected);
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(affectedCount: number): 'critical' | 'high' | 'medium' | 'low' {
    if (affectedCount > 10) return 'critical';
    if (affectedCount > 5) return 'high';
    if (affectedCount > 2) return 'medium';
    return 'low';
  }

  /**
   * Generate mitigation
   */
  private generateMitigation(affectedProducts: string[]): string {
    if (affectedProducts.length > 10) {
      return 'Critical impact detected. Recommend staged rollout with extensive testing.';
    }
    if (affectedProducts.length > 5) {
      return 'High impact. Recommend coordination with dependent teams before deployment.';
    }
    if (affectedProducts.length > 2) {
      return 'Moderate impact. Recommend notification of affected teams.';
    }
    return 'Low impact. Standard change management process sufficient.';
  }

  /**
   * Get dependency graph visualization
   */
  async getGraphVisualization(productId: string): Promise<any> {
    const graph = await this.getGraph(productId);

    return {
      nodes: this.extractNodes(graph.dependencies),
      edges: graph.dependencies.map(d => ({
        source: d.sourceProductId,
        target: d.targetProductId,
        type: d.type,
        severity: d.severity,
      })),
    };
  }

  /**
   * Extract nodes from dependencies
   */
  private extractNodes(dependencies: IDependency[]): any[] {
    const nodes = new Map<string, any>();

    dependencies.forEach(dep => {
      if (!nodes.has(dep.sourceProductId)) {
        nodes.set(dep.sourceProductId, { id: dep.sourceProductId, type: 'product' });
      }
      if (!nodes.has(dep.targetProductId)) {
        nodes.set(dep.targetProductId, { id: dep.targetProductId, type: 'product' });
      }
    });

    return Array.from(nodes.values());
  }

  /**
   * Get critical paths
   */
  async getCriticalPaths(productId: string): Promise<string[][]> {
    const graph = await this.getGraph(productId);

    const criticalDependencies = graph.dependencies.filter(d => d.severity === 'critical');

    return criticalDependencies.map(d => [d.sourceProductId, d.targetProductId]);
  }

  /**
   * Update dependency
   */
  async updateDependency(
    productId: string,
    dependencyId: string,
    updates: Partial<IDependency>,
  ): Promise<IDependencyGraph> {
    const graph = await this.getGraph(productId);
    const dependency = graph.dependencies.find(d => d.id === dependencyId);

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    Object.assign(dependency, updates);
    return graph.save();
  }

  /**
   * Get dependencies for product
   */
  async getProductDependencies(productId: string): Promise<IDependency[]> {
    const graph = await this.getGraph(productId);
    return graph.dependencies;
  }

  /**
   * Get impact analyses
   */
  async getImpactAnalyses(productId: string): Promise<IImpactAnalysis[]> {
    const graph = await this.getGraph(productId);
    return graph.impactAnalyses;
  }

  /**
   * Delete graph
   */
  async deleteGraph(productId: string): Promise<void> {
    await this.graphModel.findOneAndDelete({ productId });
  }
}
