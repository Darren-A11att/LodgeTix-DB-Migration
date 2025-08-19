import type { ReactElement } from 'react';
import type { Db } from 'mongodb';
import type { DistributionActions, DistributionResult } from '@/services/pdf/distribution';

export interface DocContext {
  db: Db;
}

export interface DocumentType<TInput, TData> {
  load(input: TInput, ctx: DocContext): Promise<any>;
  transform(raw: any, ctx: DocContext): Promise<TData>;
  validate(data: TData): void;
  title(data: TData): string;
  template(data: TData): ReactElement;
  onPersist?(data: TData, result: DistributionResult, ctx: DocContext): Promise<void>;
}

export type { DistributionActions, DistributionResult };

