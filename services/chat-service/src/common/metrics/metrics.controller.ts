import { Controller, Get } from '@nestjs/common';

/**
 * E3 8.4: Prometheus Metrics Endpoint.
 * Exposes /metrics in Prometheus text format.
 *
 * In production, use prom-client for proper histograms and counters.
 * This provides a basic implementation that can be scraped by Prometheus/Grafana.
 */

// In-memory counters (production: use prom-client Registry)
const counters: Record<string, number> = {
  chat_messages_sent_total: 0,
  chat_messages_edited_total: 0,
  chat_messages_deleted_total: 0,
  chat_reactions_total: 0,
  chat_threads_created_total: 0,
  chat_conversations_created_total: 0,
  chat_search_queries_total: 0,
  chat_webhooks_received_total: 0,
  chat_dlp_triggers_total: 0,
};

const gauges: Record<string, number> = {
  chat_websocket_connections: 0,
  chat_online_users: 0,
};

export function incrementCounter(name: string, amount: number = 1) {
  if (counters[name] !== undefined) counters[name] += amount;
}

export function setGauge(name: string, value: number) {
  gauges[name] = value;
}

@Controller('metrics')
export class MetricsController {
  @Get()
  getMetrics() {
    const lines: string[] = [];

    // Counters
    for (const [name, value] of Object.entries(counters)) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Gauges
    for (const [name, value] of Object.entries(gauges)) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Process metrics
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes ${process.memoryUsage().heapUsed}`);

    return lines.join('\n') + '\n';
  }
}
