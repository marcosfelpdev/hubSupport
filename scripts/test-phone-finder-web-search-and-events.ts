import assert from "node:assert/strict";

interface PhoneCardItem {
  id: string;
  name: string;
  description: string | null;
  pairedDeviceId: string | null;
  hasPushToken: boolean;
  status: "unpaired" | "online" | "offline";
  battery: { level: number; isCharging: boolean; updatedAt: string } | null;
  appVersionCode: number | null;
  appVersionName: string | null;
}

// 1. Simula a lógica de filteredCards em PhoneFinderPage
function filterCards(
  cards: PhoneCardItem[],
  statusFilter: "all" | "unpaired" | "online" | "offline",
  searchTerm: string
): PhoneCardItem[] {
  const query = searchTerm.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");

  return cards.filter((card) => {
    if (statusFilter !== "all" && card.status !== statusFilter) {
      return false;
    }
    if (!query) return true;

    const inName = card.name.toLowerCase().includes(query);
    const inDesc = (card.description || "").toLowerCase().includes(query);
    const cardDigits = card.name.replace(/\D/g, "");
    const inDigits =
      queryDigits.length >= 2 && cardDigits.includes(queryDigits);

    return inName || inDesc || inDigits;
  });
}

const mockCards: PhoneCardItem[] = [
  {
    id: "card-1",
    name: "8299 | 1234 | 0845 | 7421",
    description: "Portaria Central",
    pairedDeviceId: "dev-1",
    hasPushToken: true,
    status: "online",
    battery: { level: 85, isCharging: false, updatedAt: "2026-11-20T10:00:00Z" },
    appVersionCode: 1,
    appVersionName: "1.0.0",
  },
  {
    id: "card-2",
    name: "5555 | 6666",
    description: "Recepção",
    pairedDeviceId: "dev-2",
    hasPushToken: false,
    status: "offline",
    battery: { level: 42, isCharging: true, updatedAt: "2026-11-20T09:00:00Z" },
    appVersionCode: 1,
    appVersionName: "1.0.0",
  },
  {
    id: "card-3",
    name: "Card Sem Pareamento",
    description: null,
    pairedDeviceId: null,
    hasPushToken: false,
    status: "unpaired",
    battery: null,
    appVersionCode: null,
    appVersionName: null,
  },
];

console.log("-> Testando busca por 4 dígitos de substring no card '8299 | 1234 | 0845 | 7421'");
assert.equal(filterCards(mockCards, "all", "1234").length, 1);
assert.equal(filterCards(mockCards, "all", "1234")[0].id, "card-1");

assert.equal(filterCards(mockCards, "all", "0845").length, 1);
assert.equal(filterCards(mockCards, "all", "0845")[0].id, "card-1");

assert.equal(filterCards(mockCards, "all", "7421").length, 1);
assert.equal(filterCards(mockCards, "all", "7421")[0].id, "card-1");

assert.equal(filterCards(mockCards, "all", "8299").length, 1);
assert.equal(filterCards(mockCards, "all", "8299")[0].id, "card-1");

console.log("-> Testando busca com caracteres especiais e espaços");
assert.equal(filterCards(mockCards, "all", "1234 0845").length, 1);
assert.equal(filterCards(mockCards, "all", "1234 0845")[0].id, "card-1");

assert.equal(filterCards(mockCards, "all", "(82)99").length, 1);
assert.equal(filterCards(mockCards, "all", "(82)99")[0].id, "card-1");

console.log("-> Testando busca por texto (descrição ou nome tradicional)");
assert.equal(filterCards(mockCards, "all", "Portaria").length, 1);
assert.equal(filterCards(mockCards, "all", "Portaria")[0].id, "card-1");

assert.equal(filterCards(mockCards, "all", "Recepção").length, 1);
assert.equal(filterCards(mockCards, "all", "Recepção")[0].id, "card-2");

assert.equal(filterCards(mockCards, "all", "Sem Pareamento").length, 1);
assert.equal(filterCards(mockCards, "all", "Sem Pareamento")[0].id, "card-3");

console.log("-> Testando filtro por status combinado com busca");
assert.equal(filterCards(mockCards, "online", "1234").length, 1);
assert.equal(filterCards(mockCards, "offline", "1234").length, 0);

// 2. Simula reducer/handler de card:created e card:updated
function handleCreated(cards: PhoneCardItem[], newCard: PhoneCardItem): PhoneCardItem[] {
  if (cards.some((c) => c.id === newCard.id)) return cards;
  return [newCard, ...cards];
}

function handleUpdated(cards: PhoneCardItem[], updatedCard: PhoneCardItem): PhoneCardItem[] {
  return cards.map((c) => {
    if (c.id !== updatedCard.id) return c;
    const isUnpaired =
      updatedCard.status === "unpaired" ||
      (updatedCard.pairedDeviceId === null &&
        updatedCard.pairedDeviceId !== undefined);

    return {
      ...c,
      ...updatedCard,
      status: updatedCard.status || c.status,
      battery: isUnpaired ? null : (updatedCard.battery ?? c.battery),
      pairedDeviceId:
        updatedCard.pairedDeviceId !== undefined
          ? updatedCard.pairedDeviceId
          : c.pairedDeviceId,
      hasPushToken:
        updatedCard.hasPushToken !== undefined
          ? updatedCard.hasPushToken
          : c.hasPushToken,
      appVersionCode: isUnpaired
        ? null
        : (updatedCard.appVersionCode ?? c.appVersionCode),
      appVersionName: isUnpaired
        ? null
        : (updatedCard.appVersionName ?? c.appVersionName),
    };
  });
}

console.log("-> Testando card:created");
const newCard: PhoneCardItem = {
  id: "card-4",
  name: "9999",
  description: "Novo Aparelho",
  pairedDeviceId: "dev-4",
  hasPushToken: false,
  status: "online",
  battery: null,
  appVersionCode: null,
  appVersionName: null,
};

let currentCards = handleCreated(mockCards, newCard);
assert.equal(currentCards.length, 4);
assert.equal(currentCards[0].id, "card-4");

// Não deve duplicar
currentCards = handleCreated(currentCards, newCard);
assert.equal(currentCards.length, 4);

console.log("-> Testando card:updated preservando presença e telemetria");
const partialUpdated: PhoneCardItem = {
  ...currentCards[1], // card-1
  name: "8299 | 1234 | 0845 | 9999", // trocou último número
  // sem passar battery no payload ou vindo null sem desvincular
  battery: null,
};
const updatedList = handleUpdated(currentCards, partialUpdated);
assert.equal(updatedList[1].name, "8299 | 1234 | 0845 | 9999");
assert.equal(updatedList[1].status, "online");
assert.equal(updatedList[1].battery?.level, 85); // bateria preservada!

console.log("-> Testando card:updated quando desvincula");
const unpairUpdated: PhoneCardItem = {
  ...currentCards[1],
  status: "unpaired",
  pairedDeviceId: null,
  battery: null,
};
const unpairList = handleUpdated(currentCards, unpairUpdated);
assert.equal(unpairList[1].status, "unpaired");
assert.equal(unpairList[1].pairedDeviceId, null);
assert.equal(unpairList[1].battery, null); // bateria limpa quando unpaired!

console.log("Todos os testes de PhoneFinder Web Search & Socket Events passaram com sucesso!");
