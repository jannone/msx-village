export default {
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/hello') {
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
      }
      return Response.json({ message: 'Hello, world! Welcome to MSX Village.' });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
