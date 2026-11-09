/**
 * QA Automation & End-to-End Test Suite:
 * - Dropdown de Clientes no Calendário
 * - Modal de Conclusão de Reunião com Ata em Texto e Mídias Anexadas
 * - Exibição da Ata e Mídias no Perfil do Cliente
 * 
 * Executa testes ponta a ponta com servidor Express real, Prisma SQLite, Multer e APIs REST.
 */

import "dotenv/config";
import { app } from "../src/server/app";
import { prisma } from "../src/lib/prisma";
import { generateToken } from "../src/server/auth";
import type { Server } from "http";
import fs from "fs";
import path from "path";

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, suite: string, testName: string, evidence: string) {
  if (condition) {
    testResults.push({ suite, testName, passed: true, evidence });
    console.log(`  [PASS] [${suite}] ${testName}\n         -> ${evidence}`);
  } else {
    testResults.push({
      suite,
      testName,
      passed: false,
      evidence,
      error: "Assertion failed: expected true but got false",
    });
    console.error(`  [FAIL] [${suite}] ${testName}\n         -> ${evidence}`);
  }
}

function assertEqual<T>(actual: T, expected: T, suite: string, testName: string, detail?: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  const evidence = `${detail || testName} => Esperado: ${JSON.stringify(expected)}, Obtido: ${JSON.stringify(actual)}`;
  if (isMatch) {
    testResults.push({ suite, testName, passed: true, evidence });
    console.log(`  [PASS] [${suite}] ${testName}\n         -> ${evidence}`);
  } else {
    testResults.push({
      suite,
      testName,
      passed: false,
      evidence,
      error: `Mismatch: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    });
    console.error(`  [FAIL] [${suite}] ${testName}\n         -> ${evidence}`);
  }
}

async function runE2ETests() {
  console.log("\n================================================================================");
  console.log("   QA E2E TEST SUITE: AGENDA, ATAS DE REUNIÃO, MÍDIAS & PERFIL DO CLIENTE");
  console.log("================================================================================\n");

  // Iniciar servidor em porta efêmera dedicada
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🚀 Servidor HTTP de testes ativo na porta ${port} (${baseUrl})\n`);

  // Registros criados para limpeza posterior
  const createdClientIds: string[] = [];
  const createdAgendaEventIds: string[] = [];
  const createdUploadedFiles: string[] = [];
  let testAdminUserId: string | null = null;

  try {
    // -------------------------------------------------------------
    // FASE 0: Autenticação e Preparação do Ambiente
    // -------------------------------------------------------------
    console.log("--> [FASE 0] Autenticação e credenciais...");

    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", active: true },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "QA Verifier Admin",
          email: `qa.admin.${Date.now()}@hubsupport.test`,
          password: "test_password_hash",
          role: "ADMIN",
        },
      });
      testAdminUserId = adminUser.id;
    }

    const authToken = generateToken({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
    });

    assert(Boolean(authToken && authToken.length > 20), "AUTH", "Geração de Token JWT", `Token JWT gerado para ${adminUser.name} (${adminUser.role})`);

    const authHeaders = {
      Authorization: `Bearer ${authToken}`,
    };

    // -------------------------------------------------------------
    // FASE 1: Criação e Validação do Cliente para a Agenda
    // -------------------------------------------------------------
    console.log("\n--> [FASE 1] Criação do Cliente de Teste para o Calendário...");

    const testClientName = `Cliente Teste QA Agenda ${Date.now()}`;
    const createClientRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: testClientName }),
    });

    const createClientData = await createClientRes.json();
    assert(createClientRes.status === 201, "CLIENTS", "Criar cliente via POST /api/clients", `Status HTTP: ${createClientRes.status}`);
    assert(createClientData.success === true, "CLIENTS", "Retorno de sucesso ao criar cliente", `success: ${createClientData.success}`);
    assert(createClientData.client && createClientData.client.name === testClientName, "CLIENTS", "Nome do cliente persistido com precisão", `Nome retornado: ${createClientData.client?.name}`);

    const clientId = createClientData.client.id;
    createdClientIds.push(clientId);

    // Validação do seletor/dropdown: GET /api/clients deve incluir o novo cliente
    const listClientsRes = await fetch(`${baseUrl}/api/clients`, {
      headers: authHeaders,
    });
    const listClientsData = await listClientsRes.json();
    const foundInDropdown = Array.isArray(listClientsData) && listClientsData.some((c: { id: string }) => c.id === clientId);
    assert(foundInDropdown, "AGENDA_DROPDOWN", "Disponibilidade do Cliente na lista para Dropdown", `Cliente ${clientId} presente na listagem GET /api/clients`);

    // -------------------------------------------------------------
    // FASE 2: Criação de Reunião na Agenda vinculada ao Cliente
    // -------------------------------------------------------------
    console.log("\n--> [FASE 2] Criação de Evento na Agenda com Vinculação ao Cliente (Dropdown)...");

    const todayDateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const meetingTitle = "Reunião de Alinhamento Técnico";
    const meetingTime = "14:30";

    const createEventRes = await fetch(`${baseUrl}/api/agenda`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: meetingTitle,
        date: todayDateStr,
        time: meetingTime,
        category: "Reunião",
        clientId: clientId,
        employeeId: adminUser.id,
      }),
    });

    const createEventData = await createEventRes.json();
    assert(createEventRes.status === 201, "AGENDA_CREATE", "Criar evento via POST /api/agenda", `Status HTTP: ${createEventRes.status}`);
    assert(createEventData.success === true, "AGENDA_CREATE", "Retorno de sucesso ao criar evento na agenda", `success: ${createEventData.success}`);

    const event = createEventData.event;
    assert(event && event.id, "AGENDA_CREATE", "ID do evento gerado", `Evento ID: ${event?.id}`);
    assertEqual(event.title, meetingTitle, "AGENDA_CREATE", "Título da reunião conferido");
    assertEqual(event.date, todayDateStr, "AGENDA_CREATE", "Data da reunião conferida");
    assertEqual(event.time, meetingTime, "AGENDA_CREATE", "Horário da reunião conferido");
    assertEqual(event.category, "Reunião", "AGENDA_CREATE", "Categoria conferida");
    assertEqual(event.completed, false, "AGENDA_CREATE", "Status inicial completed deve ser false");
    assertEqual(event.clientId, clientId, "AGENDA_CREATE", "Vínculo correto do clientId selecionado no Dropdown");
    assert(event.client && event.client.name === testClientName, "AGENDA_CREATE", "Associação da entidade Client no payload", `Cliente vinculado: ${event.client?.name}`);

    const eventId = event.id;
    createdAgendaEventIds.push(eventId);

    // -------------------------------------------------------------
    // FASE 3: Conclusão da Reunião com Ata e Mídia via FormData
    // -------------------------------------------------------------
    console.log("\n--> [FASE 3] Conclusão da Reunião com Ata em Texto e Arquivo de Mídia Anexado...");

    const meetingNotes = "Reunião concluída com alinhamento das metas. Definido cronograma de implantação, entrega de relatórios e homologação dos módulos técnicos.";
    const sampleFileContent = Buffer.from(
      "=== ATA DE REUNIÃO DE ALINHAMENTO TÉCNICO ===\nParticipantes: QA Verifier, Suporte, Cliente\nDecisões: Aprovado deploy dos módulos."
    );

    // Preparar FormData com arquivo anexado e notas da reunião
    const formData = new FormData();
    formData.append("notes", meetingNotes);
    const mediaBlob = new Blob([sampleFileContent], { type: "text/plain" });
    formData.append("media", mediaBlob, "ata_reuniao_alinhamento.txt");

    const completeMeetingRes = await fetch(`${baseUrl}/api/agenda/${eventId}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        // Não incluir 'Content-Type': o runtime define multipart/form-data com o boundary correto
      },
      body: formData,
    });

    const completeMeetingData = await completeMeetingRes.json();
    assert(completeMeetingRes.status === 200, "MEETING_COMPLETE", "Concluir reunião via POST /api/agenda/:id/complete", `Status HTTP: ${completeMeetingRes.status}`);
    assert(completeMeetingData.success === true, "MEETING_COMPLETE", "Sucesso retornado no endpoint de conclusão", `success: ${completeMeetingData.success}`);

    const completedEvent = completeMeetingData.event;
    assert(Boolean(completedEvent), "MEETING_COMPLETE", "Payload de evento retornado", "Evento atualizado recebido");
    assertEqual(completedEvent.completed, true, "MEETING_COMPLETE", "Status completed atualizado para true");
    assert(Boolean(completedEvent.completedAt), "MEETING_COMPLETE", "Campo completedAt preenchido", `completedAt: ${completedEvent.completedAt}`);
    assertEqual(completedEvent.notes, meetingNotes, "MEETING_COMPLETE", "Texto da ata de reunião persistido integralmente");

    // Verificar se a mídia foi registrada
    let mediaList: string[] = [];
    try {
      mediaList = JSON.parse(completedEvent.media || "[]");
    } catch (e) {
      console.error("Erro ao analisar JSON de mídias:", e);
    }

    assert(Array.isArray(mediaList) && mediaList.length >= 1, "MEETING_COMPLETE", "Lista de mídias anexadas contém pelo menos 1 arquivo", `Arquivos anexados: ${JSON.stringify(mediaList)}`);
    const savedMediaPath = mediaList[0];
    assert(savedMediaPath.includes("ata_reuniao_alinhamento"), "MEETING_COMPLETE", "Nome do arquivo higienizado preservado no caminho", `Caminho gravado: ${savedMediaPath}`);

    // Rastrear caminho no disco para limpeza
    const diskPath = path.join(process.cwd(), savedMediaPath.replace(/^\//, ""));
    createdUploadedFiles.push(diskPath);

    // -------------------------------------------------------------
    // FASE 4: Verificação no Perfil do Cliente (GET /api/clients/:id)
    // -------------------------------------------------------------
    console.log("\n--> [FASE 4] Validação de Exibição da Reunião, Ata e Mídias no Perfil do Cliente...");

    const getClientProfileRes = await fetch(`${baseUrl}/api/clients/${clientId}`, {
      headers: authHeaders,
    });

    const clientProfileData = await getClientProfileRes.json();
    assert(getClientProfileRes.status === 200, "CLIENT_PROFILE", "Consultar perfil via GET /api/clients/:id", `Status HTTP: ${getClientProfileRes.status}`);
    assert(clientProfileData.client && clientProfileData.client.id === clientId, "CLIENT_PROFILE", "Perfil do cliente correto retornado", `Cliente: ${clientProfileData.client?.name}`);

    // Verificar presença da reunião no histórico de eventos do cliente
    const clientEvents: Array<{
      id: string;
      title: string;
      completed: boolean;
      completedAt: string | null;
      notes: string | null;
      media: string | null;
    }> = clientProfileData.events || [];

    const foundMeeting = clientEvents.find((evt) => evt.id === eventId);
    assert(Boolean(foundMeeting), "CLIENT_PROFILE", "Reunião concluída exibida no histórico de eventos do cliente", `Evento ${eventId} encontrado no perfil`);

    if (foundMeeting) {
      assertEqual(foundMeeting.completed, true, "CLIENT_PROFILE", "Status de conclusão no perfil do cliente");
      assert(Boolean(foundMeeting.completedAt), "CLIENT_PROFILE", "Data/hora de conclusão exibida no perfil do cliente", `completedAt: ${foundMeeting.completedAt}`);
      assertEqual(foundMeeting.notes, meetingNotes, "CLIENT_PROFILE", "Conteúdo da ata visível no perfil do cliente");

      let profileMediaList: string[] = [];
      try {
        profileMediaList = JSON.parse(foundMeeting.media || "[]");
      } catch {}

      assert(profileMediaList.length >= 1, "CLIENT_PROFILE", "Mídias anexadas disponíveis no perfil do cliente", `Total de anexos: ${profileMediaList.length}`);
      assertEqual(profileMediaList[0], savedMediaPath, "CLIENT_PROFILE", "Caminho da mídia anexada confere com o upload");
    }

    // Verificar métricas de estatísticas do cliente
    assert(clientProfileData.stats && clientProfileData.stats.totalEvents >= 1, "CLIENT_PROFILE", "Estatística totalEvents reflete o compromisso realizado", `totalEvents: ${clientProfileData.stats?.totalEvents}`);

    // -------------------------------------------------------------
    // FASE 5: Casos de Borda e Validações Adicionais
    // -------------------------------------------------------------
    console.log("\n--> [FASE 5] Testando Casos de Borda e Resiliência...");

    // 5.1 Chamada de conclusão para ID inexistente deve retornar 404
    const notFoundCompleteRes = await fetch(`${baseUrl}/api/agenda/non-existent-uuid-9999/complete`, {
      method: "POST",
      headers: authHeaders,
      body: new FormData(),
    });
    assert(notFoundCompleteRes.status === 404, "EDGE_CASES", "Conclusão de ID inexistente retorna 404", `Status HTTP: ${notFoundCompleteRes.status}`);

    // 5.2 Validação do PATCH de desmarcar / alterar reunião
    const patchRes = await fetch(`${baseUrl}/api/agenda/${eventId}`, {
      method: "PATCH",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notes: meetingNotes + " [Revisão aprovada]",
      }),
    });
    const patchData = await patchRes.json();
    assert(patchRes.status === 200, "EDGE_CASES", "Atualização parcial via PATCH /api/agenda/:id", `Status: ${patchRes.status}`);
    assert(patchData.event?.notes?.includes("[Revisão aprovada]"), "EDGE_CASES", "Ata atualizada com sucesso pelo PATCH", `Notas: ${patchData.event?.notes}`);

  } catch (err) {
    console.error("\n❌ Erro não tratado durante a execução da suíte de testes E2E:", err);
    testResults.push({
      suite: "CRITICAL_ERROR",
      testName: "Execução do Script E2E",
      passed: false,
      evidence: "Exceção disparada no loop principal",
      error: String(err),
    });
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN: Limpeza rigorosa dos dados de teste
    // -------------------------------------------------------------
    console.log("\n--> [TEARDOWN] Limpeza de dados temporários e encerramento...");

    // Limpar eventos da agenda
    for (const eventId of createdAgendaEventIds) {
      try {
        await prisma.agendaEvent.deleteMany({ where: { id: eventId } });
        console.log(`    Compromisso ${eventId} removido.`);
      } catch (err) {
        console.warn(`    Falha ao remover compromisso ${eventId}:`, err);
      }
    }

    // Limpar clientes de teste
    for (const clientId of createdClientIds) {
      try {
        await prisma.client.deleteMany({ where: { id: clientId } });
        console.log(`    Cliente ${clientId} removido.`);
      } catch (err) {
        console.warn(`    Falha ao remover cliente ${clientId}:`, err);
      }
    }

    // Limpar usuário admin criado caso tenha sido gerado exclusivamente para o teste
    if (testAdminUserId) {
      try {
        await prisma.user.deleteMany({ where: { id: testAdminUserId } });
        console.log(`    Usuário temporário de teste ${testAdminUserId} removido.`);
      } catch (err) {
        console.warn(`    Falha ao remover usuário de teste:`, err);
      }
    }

    // Limpar arquivos salvos no disco local
    for (const filePath of createdUploadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`    Arquivo de teste removido do disco: ${filePath}`);
        }
      } catch (err) {
        console.warn(`    Falha ao remover arquivo de teste ${filePath}:`, err);
      }
    }

    // Fechar servidor HTTP
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log("    Servidor HTTP de testes encerrado com sucesso.");
        resolve();
      });
    });

    // Desconectar Prisma
    await prisma.$disconnect();
  }

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("                           RELATÓRIO DE EXECUÇÃO QA");
  console.log("================================================================================");

  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.passed).length;
  const failedTests = testResults.filter((r) => !r.passed).length;

  console.log(`Total de Validações Realizadas: ${totalTests}`);
  console.log(`Aprovadas: ${passedTests}`);
  console.log(`Falhas:    ${failedTests}`);

  if (failedTests > 0) {
    console.error("\n❌ DETALHE DAS FALHAS ENCONTRADAS:");
    testResults
      .filter((r) => !r.passed)
      .forEach((fail, idx) => {
        console.error(`  ${idx + 1}. [${fail.suite}] ${fail.testName}`);
        console.error(`     Evidência: ${fail.evidence}`);
        if (fail.error) console.error(`     Erro: ${fail.error}`);
      });
    process.exit(1);
  } else {
    console.log("\n🎉 TODAS AS VALIDAÇÕES E2E PASSARAM COM 100% DE SUCESSO!");
    process.exit(0);
  }
}

runE2ETests().catch((e) => {
  console.error("Falha fatal na inicialização dos testes:", e);
  process.exit(1);
});
