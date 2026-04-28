import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ALL_DB_NAMES } from './database.tokens';

/**
 * Multi-tenant Mongoose connection factory.
 *
 * Registers ONE Mongo connection per module DB name (e.g. `nexora_auth`,
 * `nexora_payroll`). Each module imports its own connection by name in
 * its `MongooseModule.forFeature([...], <DB_NAME>)` call.
 *
 * Why this matters for the split lever: when you peel a module off into
 * its own service tomorrow, you only change ONE thing — the URI for that
 * one named connection — to point at a dedicated cluster. The schema
 * registrations elsewhere don't need to know.
 *
 * Today all 17 named connections share a single Mongo instance via the
 * same MONGODB_URI; only the DB name differs. Free, near-zero overhead.
 */
@Global()
@Module({
  imports: [
    // Default (un-named) connection — used by the few cross-cutting
    // things that haven't been moved into a module yet (e.g. health
    // checks). All real schemas should use a named connection.
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),

    // One named connection per module DB. Modules consume these by name:
    //   MongooseModule.forFeature([...schemas], AUTH_DB)
    ...ALL_DB_NAMES.map((dbName) =>
      MongooseModule.forRootAsync({
        connectionName: dbName,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (cfg: ConfigService) => {
          // Allow per-module URI override for the day you split: e.g.
          //   MONGODB_URI_NEXORA_PAYROLL=mongodb+srv://payroll-cluster/...
          // Falls back to the shared cluster otherwise.
          const overrideKey = `MONGODB_URI_${dbName.toUpperCase()}`;
          const baseUri =
            cfg.get<string>(overrideKey) ||
            cfg.get<string>('MONGODB_URI') ||
            'mongodb://localhost:27017';
          // If the URI has a path component, replace it. Otherwise append.
          const uri = replaceDbInUri(baseUri, dbName);
          return {
            uri,
            retryAttempts: 5,
            retryDelay: 5000,
          };
        },
      }),
    ),
  ],
})
export class DatabaseModule {}

function replaceDbInUri(uri: string, dbName: string): string {
  // Strip any existing path / query, then re-attach with the target db.
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/([^?]*))?(\?.*)?$/);
  if (!m) return `${uri.replace(/\/$/, '')}/${dbName}`;
  const [, host, , query] = m;
  return `${host}/${dbName}${query || ''}`;
}
