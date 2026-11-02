import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FeaturesGuard } from './common/guards/features.guard';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { CostCategoriesModule } from './modules/cost-categories/cost-categories.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProjectAssignmentsModule } from './modules/project-assignments/project-assignments.module';
import { ProjectOperatingCostsModule } from './modules/project-operating-costs/project-operating-costs.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { RevenuePlansModule } from './modules/revenue-plans/revenue-plans.module';
import { AcceptancesModule } from './modules/acceptances/acceptances.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { FinancialControlModule } from './modules/financial-control/financial-control.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ContractAttachmentsModule } from './modules/contract-attachments/contract-attachments.module';
import { AcceptanceAttachmentsModule } from './modules/acceptance-attachments/acceptance-attachments.module';
import { AcceptanceSchedulesModule } from './modules/acceptance-schedules/acceptance-schedules.module';
import { ProjectReportSubmissionsModule } from './modules/project-report-submissions/project-report-submissions.module';
import { MusicVotingModule } from './modules/music-voting/music-voting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    CustomersModule,
    CompaniesModule,
    EmployeesModule,
    CostCategoriesModule,
    ProjectsModule,
    ProjectAssignmentsModule,
    ProjectOperatingCostsModule,
    ContractsModule,
    RevenuePlansModule,
    AcceptancesModule,
    CollectionsModule,
    FinancialControlModule,
    DashboardModule,
    ContractAttachmentsModule,
    AcceptanceAttachmentsModule,
    AcceptanceSchedulesModule,
    ProjectReportSubmissionsModule,
    MusicVotingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Tài khoản LIMITED: chỉ API được @AllowFeature / @AnyUser (chạy sau JwtAuthGuard)
    { provide: APP_GUARD, useClass: FeaturesGuard },
  ],
})
export class AppModule {}
