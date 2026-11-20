import assert from "node:assert/strict";
import { formatCardTitleFromNumbers } from "../src/server/phoneFinder/titleFormatter";
import { InMemoryPhoneCardRepository } from "../src/server/phoneFinder/cardRepository";

async function runTests() {
  // 1. Testa formatação válida com 1 a 4 números
  assert.deepEqual(formatCardTitleFromNumbers(["8299", "1234", "0845", "7421"]), {
    success: true,
    title: "8299 | 1234 | 0845 | 7421",
    validNumbers: ["8299", "1234", "0845", "7421"]
  });

  assert.deepEqual(formatCardTitleFromNumbers(["8299", "1234", "", "   "]), {
    success: true,
    title: "8299 | 1234",
    validNumbers: ["8299", "1234"]
  });

  // 2. Testa descarte de caracteres não numéricos
  assert.deepEqual(formatCardTitleFromNumbers(["(82)99", "12-34"]), {
    success: true,
    title: "8299 | 1234",
    validNumbers: ["8299", "1234"]
  });

  // 3. Testa rejeição para entradas vazias ou com menos/mais de 4 dígitos
  assert.equal(formatCardTitleFromNumbers([]).success, false);
  assert.equal(formatCardTitleFromNumbers(["123", "12345"]).success, false);

  // 4. Testa limites (máximo 4 números) e entradas inválidas/não-array
  assert.deepEqual(formatCardTitleFromNumbers(["1111", "2222", "3333", "4444", "5555"]), {
    success: true,
    title: "1111 | 2222 | 3333 | 4444",
    validNumbers: ["1111", "2222", "3333", "4444"]
  });
  assert.equal(formatCardTitleFromNumbers(null).success, false);
  assert.equal(formatCardTitleFromNumbers(undefined).success, false);
  assert.equal(formatCardTitleFromNumbers("not-an-array").success, false);

  // 5. Testa busca no repositório por nome (findByName)
  const repo = new InMemoryPhoneCardRepository();
  await repo.create({ name: "8299 | 1234", description: "Bancada 1" });
  
  const found = await repo.findByName("8299 | 1234");
  assert.ok(found);
  assert.equal(found.name, "8299 | 1234");
  
  const trimmedFound = await repo.findByName("  8299 | 1234  ");
  assert.ok(trimmedFound);
  assert.equal(trimmedFound.name, "8299 | 1234");
  
  const notFound = await repo.findByName("9999");
  assert.equal(notFound, null);

  console.log("Todos os testes de titleFormatter e cardRepository.findByName passaram com sucesso!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
