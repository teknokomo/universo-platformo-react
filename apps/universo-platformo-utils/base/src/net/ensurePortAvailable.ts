import net from 'net'

export async function ensurePortAvailable(port: number, host?: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tester = net
      .createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${host ?? '0.0.0.0'}:${port} is already in use`))
        } else {
          reject(err)
        }
      })
      .once('listening', () => {
        tester.close((err?: Error) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
      .listen(port, host)
  })
}