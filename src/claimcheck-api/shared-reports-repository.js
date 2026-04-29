import { Database } from "./db.js";
import { ShareIdGenerator } from "./share-id-generator.js";

const DEFAULT_TTL_DAYS = 90;

export class SharedReportsRepository {
  constructor({
    sql = null,
    idGenerator = new ShareIdGenerator(),
    ttlDays = Number(process.env.SHARE_REPORT_TTL_DAYS || DEFAULT_TTL_DAYS),
  } = {}) {
    this.sqlClient = sql;
    this.idGenerator = idGenerator;
    this.ttlDays = ttlDays;
  }

  get sql() {
    return this.sqlClient ?? Database.sql;
  }

  async create({ report, regNumber = null, nickname = null }) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sql = this.sql;
      const id = this.idGenerator.generate();
      const rows = await sql`
        insert into shared_reports (id, report, reg_number, nickname, expires_at)
        values (
          ${id},
          ${sql.json(report)},
          ${regNumber},
          ${nickname},
          now() + (${this.ttlDays}::text || ' days')::interval
        )
        on conflict (id) do nothing
        returning id, report, reg_number, nickname, created_at, expires_at
      `;

      if (rows.length > 0) return this.toDomain(rows[0]);
    }

    throw new Error("Unable to generate a unique share id");
  }

  async findById(id) {
    const sql = this.sql;
    const rows = await sql`
      select id, report, reg_number, nickname, created_at, expires_at
      from shared_reports
      where id = ${id}
        and (expires_at is null or expires_at > now())
      limit 1
    `;

    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async deleteExpired() {
    const sql = this.sql;
    const rows = await sql`
      delete from shared_reports
      where expires_at is not null
        and expires_at <= now()
      returning id
    `;

    return rows.length;
  }

  toDomain(row) {
    return {
      id: row.id,
      report: row.report,
      regNumber: row.reg_number,
      nickname: row.nickname,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }
}
