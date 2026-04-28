/**
 * REFERENCE TEMPLATE — copy this folder to scaffold a new module.
 *
 * Replace `_template` with the module name (e.g. `auth`, `payroll`) and
 * follow the structure:
 *
 *   modules/<name>/
 *     <name>.module.ts            ← THIS file (NestModule wrapper)
 *     <name>.bootstrap.ts         ← Per-module standalone entrypoint
 *     public-api/                 ← What other modules MAY consume
 *       <name>-public-api.ts      ← Interface only — the contract
 *       <name>-public-api.impl.ts ← In-process implementation
 *       index.ts                  ← Barrel export (token + interface)
 *     events/                     ← Domain events this module publishes
 *       <event>.event.ts
 *     internal/                   ← Off-limits to other modules
 *       <name>.controller.ts      ← HTTP routes
 *       <name>.service.ts         ← Business logic
 *       services/                 ← Sub-services
 *     schemas/                    ← Mongoose schemas (private)
 *     dto/                        ← Request/response DTOs (private to module)
 *
 * Rules of the road:
 *   1. Other modules see ONLY public-api/ and events/. Never import
 *      from internal/, schemas/, or dto/ across module boundaries
 *      (.eslintrc enforces this).
 *   2. Each module declares ONE Mongo connection name (see
 *      bootstrap/database/database.tokens.ts).
 *   3. Cross-module sync calls go through the public-api token.
 *   4. Cross-module signals go through EventBus.
 *   5. The bootstrap.ts file lets you deploy this module as a standalone
 *      microservice without changing any caller code — that's the split
 *      lever.
 */
import { Module } from '@nestjs/common';

@Module({})
export class TemplateModule {}
