import { and, count, eq, gte, sql } from 'drizzle-orm';
import { trial } from './schema';
import type { DBType } from '#db/sqlite';

type TrialCreateType = {
  tokenHash: string;
  requestIpHash: string;
  clientId: ID;
  campaign?: string;
  startedAt: string;
  expiresAt: string;
};

function createPreparedStatements(db: DBType) {
  return {
    findByTokenHash: db.query.trial
      .findFirst({
        where: eq(trial.tokenHash, sql.placeholder('tokenHash')),
      })
      .prepare(),
    touch: db
      .update(trial)
      .set({ lastSeenAt: sql.placeholder('lastSeenAt') as never as string })
      .where(eq(trial.id, sql.placeholder('id')))
      .prepare(),
  };
}

export class TrialService {
  #db: DBType;
  #statements: ReturnType<typeof createPreparedStatements>;

  constructor(db: DBType) {
    this.#db = db;
    this.#statements = createPreparedStatements(db);
  }

  findByTokenHash(tokenHash: string) {
    return this.#statements.findByTokenHash.execute({ tokenHash });
  }

  async countRecentForIp(requestIpHash: string, since: string) {
    const [result] = await this.#db
      .select({ value: count() })
      .from(trial)
      .where(
        and(
          eq(trial.requestIpHash, requestIpHash),
          gte(trial.startedAt, since)
        )
      )
      .execute();

    return result?.value ?? 0;
  }

  create(data: TrialCreateType) {
    return this.#db.insert(trial).values(data).returning().execute();
  }

  touch(id: ID, lastSeenAt: string) {
    return this.#statements.touch.execute({ id, lastSeenAt });
  }
}
