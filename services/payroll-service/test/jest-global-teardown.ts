export default async function globalTeardown() {
  const mongod = (global as any).__MONGOD__;
  if (mongod) {
    await mongod.stop();
    console.log('\n🧪 Test MongoDB stopped\n');
  }
}
