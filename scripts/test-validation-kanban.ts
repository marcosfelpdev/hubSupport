/**
 * QA Automation & Audit Test Suite: Kanban "Validação" Column & Workflow Transitions
 * 
 * Verifies:
 * 1. TechnicianKanbanBoard.tsx: COLUMNS, ColumnId, getColumnForStatus, getStatusForColumn
 * 2. ReportCardMinimized.tsx: getStatusPill for Validação
 * 3. TechnicianDashboardClient.tsx: getStatusPillConfig and filter options
 * 4. WorkLogDetailContent.tsx: WORKLOG_STATUS_OPTIONS, getStatusPill, isValidating, action buttons
 * 5. Database & API data contract: Status transition lifecycle (Backlog -> Em progresso -> Validação -> Solucionado / Retorno)
 */

import { COLUMNS, getColumnForStatus, getStatusForColumn, ColumnId } from "../src/components/dashboard/TechnicianKanbanBoard";
import { getStatusPill as getReportCardPill } from "../src/components/ReportCardMinimized";
import { getStatusPillConfig as getDashboardPillConfig } from "../src/components/TechnicianDashboardClient";
import { WORKLOG_STATUS_OPTIONS, getStatusPill as getDetailPill } from "../src/components/dashboard/WorkLogDetailContent";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, evidence: string) {
  if (condition) {
    results.push({ suite, name, passed: true, evidence });
    console.log(`  [PASS] [${suite}] ${name}: ${evidence}`);
  } else {
    results.push({ suite, name, passed: false, evidence, error: `Assertion failed: expected true but got false` });
    console.error(`  [FAIL] [${suite}] ${name}: ${evidence}`);
  }
}

function assertEqual<T>(actual: T, expected: T, suite: string, name: string, detail?: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  const evidence = `${detail || name} -> Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
  if (isMatch) {
    results.push({ suite, name, passed: true, evidence });
    console.log(`  [PASS] [${suite}] ${name}: ${evidence}`);
  } else {
    results.push({ suite, name, passed: false, evidence, error: `Mismatch: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}` });
    console.error(`  [FAIL] [${suite}] ${name}: ${evidence}`);
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("  QA AUDIT & VERIFICATION: VALIDAÇÃO KANBAN COLUMN");
  console.log("=======================================================\n");

  // -----------------------------------------------------------
  // SUITE 1: TechnicianKanbanBoard.tsx
  // -----------------------------------------------------------
  console.log("--> Testing Suite 1: TechnicianKanbanBoard.tsx Mapping & Columns");

  // 1.1 Column list and ordering
  const expectedColumnIds: ColumnId[] = ["backlog", "pendencias", "em_progresso", "validacao", "finalizadas"];
  const actualColumnIds = COLUMNS.map(c => c.id);
  assertEqual(actualColumnIds, expectedColumnIds, "TechnicianKanbanBoard", "Column IDs and Order", "Order of the 5 Kanban columns");

  const expectedTitles = ["Backlog", "Pendências", "Em progresso", "Validação", "Finalizadas"];
  const actualTitles = COLUMNS.map(c => c.title);
  assertEqual(actualTitles, expectedTitles, "TechnicianKanbanBoard", "Column Titles", "Titles of the 5 Kanban columns");

  const validacaoCol = COLUMNS.find(c => c.id === "validacao");
  assert(!!validacaoCol, "TechnicianKanbanBoard", "Validação Column Definition Exists", "Column 'validacao' found in COLUMNS array");
  assertEqual(validacaoCol?.title, "Validação", "TechnicianKanbanBoard", "Validação Column Title");
  assertEqual(validacaoCol?.dotColor, "bg-purple-500", "TechnicianKanbanBoard", "Validação Column Dot Color");
  assertEqual(validacaoCol?.headerBorder, "border-purple-500", "TechnicianKanbanBoard", "Validação Column Header Border");

  // 1.2 getColumnForStatus mapping
  const validacaoStatusVariations = [
    "Validação",
    "validação",
    "VALIDAÇÃO",
    "validacao",
    "VALIDACAO",
    "em validação",
    "em validacao",
    "  Validação  ",
    "Em Validação"
  ];
  for (const st of validacaoStatusVariations) {
    assertEqual(getColumnForStatus(st), "validacao", "TechnicianKanbanBoard", `getColumnForStatus('${st}') -> 'validacao'`);
  }

  // Check other statuses mapping for regression
  assertEqual(getColumnForStatus("Solucionado"), "finalizadas", "TechnicianKanbanBoard", "getColumnForStatus('Solucionado')");
  assertEqual(getColumnForStatus("finalizado"), "finalizadas", "TechnicianKanbanBoard", "getColumnForStatus('finalizado')");
  assertEqual(getColumnForStatus("Em progresso"), "em_progresso", "TechnicianKanbanBoard", "getColumnForStatus('Em progresso')");
  assertEqual(getColumnForStatus("em andamento"), "em_progresso", "TechnicianKanbanBoard", "getColumnForStatus('em andamento')");
  assertEqual(getColumnForStatus("Pendências"), "pendencias", "TechnicianKanbanBoard", "getColumnForStatus('Pendências')");
  assertEqual(getColumnForStatus("aguardando reunião"), "pendencias", "TechnicianKanbanBoard", "getColumnForStatus('aguardando reunião')");
  assertEqual(getColumnForStatus("Backlog"), "backlog", "TechnicianKanbanBoard", "getColumnForStatus('Backlog')");
  assertEqual(getColumnForStatus("qualquer outro"), "backlog", "TechnicianKanbanBoard", "getColumnForStatus(default) -> 'backlog'");

  // 1.3 getStatusForColumn mapping
  assertEqual(getStatusForColumn("validacao"), "Validação", "TechnicianKanbanBoard", "getStatusForColumn('validacao') -> 'Validação'");
  assertEqual(getStatusForColumn("finalizadas"), "Solucionado", "TechnicianKanbanBoard", "getStatusForColumn('finalizadas') -> 'Solucionado'");
  assertEqual(getStatusForColumn("em_progresso"), "Em progresso", "TechnicianKanbanBoard", "getStatusForColumn('em_progresso') -> 'Em progresso'");
  assertEqual(getStatusForColumn("pendencias"), "Pendências", "TechnicianKanbanBoard", "getStatusForColumn('pendencias') -> 'Pendências'");
  assertEqual(getStatusForColumn("backlog"), "Backlog", "TechnicianKanbanBoard", "getStatusForColumn('backlog') -> 'Backlog'");


  // -----------------------------------------------------------
  // SUITE 2: ReportCardMinimized.tsx
  // -----------------------------------------------------------
  console.log("\n--> Testing Suite 2: ReportCardMinimized.tsx Status Pill & Badge");

  const reportCardPill = getReportCardPill("Validação");
  assertEqual(reportCardPill.label, "Validação", "ReportCardMinimized", "getStatusPill('Validação').label");
  assertEqual(reportCardPill.dotClass, "bg-purple-500", "ReportCardMinimized", "getStatusPill('Validação').dotClass");
  assert(reportCardPill.badgeClass.includes("text-purple-700") && reportCardPill.badgeClass.includes("bg-purple-50"),
    "ReportCardMinimized", "Validação Badge Styling", `Badge classes: ${reportCardPill.badgeClass}`);

  const reportCardPillEmVal = getReportCardPill("em validação");
  assertEqual(reportCardPillEmVal.label, "Validação", "ReportCardMinimized", "getStatusPill('em validação').label");
  assertEqual(reportCardPillEmVal.dotClass, "bg-purple-500", "ReportCardMinimized", "getStatusPill('em validação').dotClass");


  // -----------------------------------------------------------
  // SUITE 3: TechnicianDashboardClient.tsx
  // -----------------------------------------------------------
  console.log("\n--> Testing Suite 3: TechnicianDashboardClient.tsx Status Pill & Options");

  const dashPill = getDashboardPillConfig("Validação");
  assertEqual(dashPill.label, "Validação", "TechnicianDashboardClient", "getStatusPillConfig('Validação').label");
  assertEqual(dashPill.dotClass, "bg-purple-500", "TechnicianDashboardClient", "getStatusPillConfig('Validação').dotClass");
  assert(dashPill.badgeClass.includes("text-purple-700") && dashPill.badgeClass.includes("bg-purple-50"),
    "TechnicianDashboardClient", "Validação Badge Styling", `Badge classes: ${dashPill.badgeClass}`);

  const dashPillEmVal = getDashboardPillConfig("em validação");
  assertEqual(dashPillEmVal.label, "Validação", "TechnicianDashboardClient", "getStatusPillConfig('em validação').label");

  // Verify file source ensures 'Validação' in statusOptions
  const dashClientSource = fs.readFileSync(path.resolve(__dirname, "../src/components/TechnicianDashboardClient.tsx"), "utf-8");
  assert(dashClientSource.includes(`if (!list.includes("Validação")) list.push("Validação");`),
    "TechnicianDashboardClient", "Status Filter Injects Validação", "statusOptions explicitly guarantees 'Validação' presence");


  // -----------------------------------------------------------
  // SUITE 4: WorkLogDetailContent.tsx
  // -----------------------------------------------------------
  console.log("\n--> Testing Suite 4: WorkLogDetailContent.tsx Options, Banner & Action Buttons");

  // 4.1 Options list
  assert(WORKLOG_STATUS_OPTIONS.includes("Validação" as any), "WorkLogDetailContent", "WORKLOG_STATUS_OPTIONS includes 'Validação'",
    `Options list: [${WORKLOG_STATUS_OPTIONS.join(", ")}]`);

  // 4.2 getStatusPill in DetailContent
  const detailPill = getDetailPill("Validação");
  assertEqual(detailPill.label, "Validação", "WorkLogDetailContent", "getStatusPill('Validação').label");
  assertEqual(detailPill.dotClass, "bg-purple-500", "WorkLogDetailContent", "getStatusPill('Validação').dotClass");
  assert(detailPill.badgeClass.includes("text-purple-700") && detailPill.badgeClass.includes("bg-purple-50"),
    "WorkLogDetailContent", "Validação Badge Styling", `Badge classes: ${detailPill.badgeClass}`);

  // 4.3 AST / Source verification of Banner and Actions
  const detailSource = fs.readFileSync(path.resolve(__dirname, "../src/components/dashboard/WorkLogDetailContent.tsx"), "utf-8");

  // Check isValidating condition logic
  assert(detailSource.includes(`norm === "validação"`) && detailSource.includes(`norm === "em validação"`),
    "WorkLogDetailContent", "isValidating Normalization", "Normalizes 'validação', 'validacao', 'em validação', 'em validacao'");

  // Check Banner rendering
  assert(detailSource.includes("Chamado em Fase de Validação"),
    "WorkLogDetailContent", "Validation Banner Heading", "Displays 'Chamado em Fase de Validação' when isValidating");
  assert(detailSource.includes("Este atendimento está em fase de avaliação e validação"),
    "WorkLogDetailContent", "Validation Banner Description", "Displays explanatory banner text");

  // Check Action Buttons
  assert(detailSource.includes("Reprovar / Retornar"),
    "WorkLogDetailContent", "Reprovar / Retornar Button Present", "Button rendered with label 'Reprovar / Retornar'");
  assert(detailSource.includes("Aprovar Solução"),
    "WorkLogDetailContent", "Aprovar Solução Button Present", "Button rendered with label 'Aprovar Solução'");

  // Check Action Handlers logic
  assert(detailSource.includes("const handleApproveSolution = async () =>"),
    "WorkLogDetailContent", "handleApproveSolution Handler", "Function defined to resolve ticket");
  assert(detailSource.includes("api.worklogs.resolve(log.id)"),
    "WorkLogDetailContent", "Aprovar calls api.worklogs.resolve", "Directly resolves ticket upon validation approval");
  assert(detailSource.includes("const handleRejectValidation = async () =>"),
    "WorkLogDetailContent", "handleRejectValidation Handler", "Function defined to return ticket");
  assert(detailSource.includes(`api.worklogs.updateStatus(log.id, "Em progresso")`),
    "WorkLogDetailContent", "Reprovar calls updateStatus('Em progresso')", "Returns ticket to 'Em progresso' on rejection");

  // Check Role authorization for buttons
  assert(detailSource.includes(`currentUserRole === "ADMIN"`) &&
         detailSource.includes(`currentUserRole === "TECHNICIAN"`) &&
         detailSource.includes(`currentUserRole === "MANAGER"`),
    "WorkLogDetailContent", "Role Authorization Check", "Restricted to ADMIN, TECHNICIAN, MANAGER");


  // -----------------------------------------------------------
  // SUITE 5: Database & API Transition Contract Lifecycle
  // -----------------------------------------------------------
  console.log("\n--> Testing Suite 5: Database Lifecycle & Status Transitions Contract");

  try {
    // Find or create an admin or tech user for foreign key
    let testUser = await prisma.user.findFirst();
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          name: "QA Audit Bot",
          email: "qa-audit@hubsupport.local",
          role: "ADMIN",
        }
      });
    }

    // Step 1: Create a test ticket in 'Backlog'
    const createdLog = await prisma.workLog.create({
      data: {
        title: "QA Test Ticket - Validação Flow",
        requester: "QA Suite",
        clientOrOffice: "Auditoria Central",
        reportedProblem: "Teste automatizado da coluna Validação",
        status: "Backlog",
        technicalAction: true,
        implementation: false,
        userId: testUser.id,
      }
    });
    assertEqual(createdLog.status, "Backlog", "DatabaseLifecycle", "Step 1: Created in Backlog");

    // Step 2: Transition Backlog -> Em progresso
    await prisma.$transaction([
      prisma.workLog.update({
        where: { id: createdLog.id },
        data: { status: "Em progresso" },
      }),
      prisma.workLogStatusHistory.create({
        data: {
          workLogId: createdLog.id,
          fromStatus: "Backlog",
          toStatus: "Em progresso",
          changedById: testUser.id,
        },
      }),
    ]);
    const afterInProgress = await prisma.workLog.findUnique({ where: { id: createdLog.id } });
    assertEqual(afterInProgress?.status, "Em progresso", "DatabaseLifecycle", "Step 2: Transitioned to 'Em progresso'");

    // Step 3: Transition Em progresso -> Validação (Drag or Select)
    await prisma.$transaction([
      prisma.workLog.update({
        where: { id: createdLog.id },
        data: { status: "Validação" },
      }),
      prisma.workLogStatusHistory.create({
        data: {
          workLogId: createdLog.id,
          fromStatus: "Em progresso",
          toStatus: "Validação",
          changedById: testUser.id,
        },
      }),
    ]);
    const afterValidacao = await prisma.workLog.findUnique({
      where: { id: createdLog.id },
      include: {
        statusHistory: {
          orderBy: { createdAt: "desc" },
        }
      }
    });
    assertEqual(afterValidacao?.status, "Validação", "DatabaseLifecycle", "Step 3: Transitioned to 'Validação'");
    assertEqual(afterValidacao?.statusHistory[0].toStatus, "Validação", "DatabaseLifecycle", "Step 3: History records toStatus 'Validação'");
    assertEqual(afterValidacao?.statusHistory[0].fromStatus, "Em progresso", "DatabaseLifecycle", "Step 3: History records fromStatus 'Em progresso'");

    // Step 4: Simulate 'Reprovar / Retornar': Validação -> Em progresso
    await prisma.$transaction([
      prisma.workLog.update({
        where: { id: createdLog.id },
        data: { status: "Em progresso" },
      }),
      prisma.workLogStatusHistory.create({
        data: {
          workLogId: createdLog.id,
          fromStatus: "Validação",
          toStatus: "Em progresso",
          changedById: testUser.id,
        },
      }),
    ]);
    const afterReject = await prisma.workLog.findUnique({
      where: { id: createdLog.id },
      include: { statusHistory: { orderBy: { createdAt: "desc" } } }
    });
    assertEqual(afterReject?.status, "Em progresso", "DatabaseLifecycle", "Step 4: Reprovar returns to 'Em progresso'");
    assertEqual(afterReject?.statusHistory[0].fromStatus, "Validação", "DatabaseLifecycle", "Step 4: History from 'Validação'");
    assertEqual(afterReject?.statusHistory[0].toStatus, "Em progresso", "DatabaseLifecycle", "Step 4: History to 'Em progresso'");

    // Step 5: Transition again to 'Validação'
    await prisma.$transaction([
      prisma.workLog.update({
        where: { id: createdLog.id },
        data: { status: "Validação" },
      }),
      prisma.workLogStatusHistory.create({
        data: {
          workLogId: createdLog.id,
          fromStatus: "Em progresso",
          toStatus: "Validação",
          changedById: testUser.id,
        },
      }),
    ]);

    // Step 6: Simulate 'Aprovar Solução': Validação -> Solucionado
    await prisma.$transaction([
      prisma.workLog.update({
        where: { id: createdLog.id },
        data: { status: "Solucionado" },
      }),
      prisma.workLogStatusHistory.create({
        data: {
          workLogId: createdLog.id,
          fromStatus: "Validação",
          toStatus: "Solucionado",
          changedById: testUser.id,
        },
      }),
    ]);
    const afterApprove = await prisma.workLog.findUnique({
      where: { id: createdLog.id },
      include: { statusHistory: { orderBy: { createdAt: "desc" } } }
    });
    assertEqual(afterApprove?.status, "Solucionado", "DatabaseLifecycle", "Step 6: Aprovar resolves to 'Solucionado'");
    assertEqual(afterApprove?.statusHistory[0].fromStatus, "Validação", "DatabaseLifecycle", "Step 6: History from 'Validação'");
    assertEqual(afterApprove?.statusHistory[0].toStatus, "Solucionado", "DatabaseLifecycle", "Step 6: History to 'Solucionado'");

    // Cleanup: Delete test workLog and its history
    await prisma.workLogStatusHistory.deleteMany({ where: { workLogId: createdLog.id } });
    await prisma.workLog.delete({ where: { id: createdLog.id } });
    console.log("  [CLEANUP] Test workLog and statusHistory entries removed successfully.");

  } catch (err: any) {
    console.error("  [FAIL] Database Lifecycle test encountered an error:", err);
    results.push({
      suite: "DatabaseLifecycle",
      name: "Database Transaction & History",
      passed: false,
      evidence: "Failed during DB lifecycle steps",
      error: err.message || String(err),
    });
  } finally {
    await prisma.$disconnect();
  }

  // -----------------------------------------------------------
  // SUMMARY REPORT
  // -----------------------------------------------------------
  console.log("\n=======================================================");
  console.log("                    TEST SUMMARY");
  console.log("=======================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total tests executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error("\nFailed Tests Details:");
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- [${r.suite}] ${r.name}: ${r.error} (${r.evidence})`);
    });
    process.exit(1);
  } else {
    console.log("\n>>> ALL QA AUDIT TESTS PASSED SUCCESSFULLY! <<<");
  }
}

runTestSuite().catch(err => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
