import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Duplex } from 'node:stream';

/** Real Nest/Express request pipeline with an in-memory HTTP transport; no TCP. */
export function request(server: Server) {
  const route = (method: string, url: string) => {
    let payload: unknown;
    const operation = {
      send(body: unknown) {
        payload = body;
        return operation;
      },
      expect(status: number): Promise<void> {
        return new Promise((resolve, reject) => {
          const socket = new Duplex({
            read() {},
            write(_chunk, _encoding, callback) {
              callback();
            },
          }) as Socket;
          const incoming = new IncomingMessage(socket);
          incoming.method = method;
          incoming.url = url;
          incoming.httpVersion = '1.1';
          const body = payload === undefined ? '' : JSON.stringify(payload);
          incoming.headers = {
            host: 'synthetic.test',
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(body)),
          };
          const response = new ServerResponse(incoming);
          response.once('error', reject);
          jest.spyOn(response, 'end').mockImplementation(() => {
            socket.destroy();
            try {
              expect(response.statusCode).toBe(status);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
            return response;
          });
          server.emit('request', incoming, response);
          if (body) incoming.push(body);
          incoming.push(null);
        });
      },
    };
    return operation;
  };
  return {
    get: (url: string) => route('GET', url),
    patch: (url: string) => route('PATCH', url),
  };
}
