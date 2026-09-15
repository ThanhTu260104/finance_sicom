import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProjectAssignmentsModule } from './modules/project-assignments/project-assignments.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { RevenuePlansModule } from './modules/revenue-plans/revenue-plans.module';
import { AcceptancesModule } from './modules/acceptances/acceptances.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { FinancialControlModule } from './modules/financial-control/financial-control.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ContractAttachmentsModule } from './modules/contract-attachments/contract-attachments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CustomersModule,
    ProjectsModule,
    ProjectAssignmentsModule,
    ContractsModule,
    RevenuePlansModule,
    AcceptancesModule,
    CollectionsModule,
    FinancialControlModule,
    DashboardModule,
    ContractAttachmentsModule,
  ],
})
export class AppModule {}
