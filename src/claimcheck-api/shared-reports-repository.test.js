import { describe, expect, it, vi } from "vitest";
import { SharedReportsRepository } from "./shared-reports-repository.js";

function createSqlMock(rowsByCall) {
  const sql = vi.fn((_strings, ...values) => {
    sql.calls.push(values);
    return Promise.resolve(rowsByCall.shift() ?? []);
  });
  sql.calls = [];
  sql.json = vi.fn((value) => ({ json: value }));
  return sql;
}

describe("SharedReportsRepository", () => {
  it("creates a shared report and maps database rows to domain shape", async () => {
    const sql = createSqlMock([
      [
        {
          id: "AbC123xY",
          report: { risk: "GREEN", summary: "ok", findings: [], fixes: [] },
          reg_number: "MH12AB1234",
          nickname: "Swift",
          created_at: "2026-04-29T00:00:00.000Z",
          expires_at: "2026-07-28T00:00:00.000Z",
        },
      ],
    ]);
    const idGenerator = { generate: vi.fn(() => "AbC123xY") };
    const repository = new SharedReportsRepository({ sql, idGenerator, ttlDays: 30 });

    const share = await repository.create({
      report: { risk: "GREEN", summary: "ok", findings: [], fixes: [] },
      regNumber: "MH12AB1234",
      nickname: "Swift",
    });

    expect(share.id).toBe("AbC123xY");
    expect(share.regNumber).toBe("MH12AB1234");
    expect(share.nickname).toBe("Swift");
    expect(sql.json).toHaveBeenCalledWith({
      risk: "GREEN",
      summary: "ok",
      findings: [],
      fixes: [],
    });
  });

  it("retries when an id collision returns no inserted row", async () => {
    const sql = createSqlMock([
      [],
      [
        {
          id: "Second1",
          report: { risk: "AMBER", summary: "ok", findings: [], fixes: [] },
          reg_number: null,
          nickname: null,
          created_at: "2026-04-29T00:00:00.000Z",
          expires_at: null,
        },
      ],
    ]);
    const idGenerator = {
      generate: vi.fn().mockReturnValueOnce("First11").mockReturnValueOnce("Second1"),
    };
    const repository = new SharedReportsRepository({ sql, idGenerator });

    const share = await repository.create({
      report: { risk: "AMBER", summary: "ok", findings: [], fixes: [] },
    });

    expect(share.id).toBe("Second1");
    expect(idGenerator.generate).toHaveBeenCalledTimes(2);
  });

  it("returns null when a share id is not found", async () => {
    const sql = createSqlMock([[]]);
    const repository = new SharedReportsRepository({ sql });

    await expect(repository.findById("missing")).resolves.toBeNull();
  });
});
