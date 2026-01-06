const API_KEY = crypto.randomUUID()
logOk(`Generated a key: ${API_KEY}`)
Deno.serve({ port: 4242 }, handler)

function logOk(message: string) {
  const now = new Date()
  console.log(now.toISOString() + " %c" + message, "color: green")
}
function logErr(message: string) {
  const now = new Date()
  console.log(now.toISOString() + " %c" + message, "color: red")
}

function handler(request) {
  const url = new URL(request.url)
  const verb = request.method
  const endpoint = url.pathname
  const query = url.searchParams

  if (verb === "GET" && endpoint === "/upgrade") {
    return auth(query).then(upgradeServer).catch(deny)
  } else {
    return notFound()
  }

  function deny() {
    logErr(`Access denied to ${verb} ${endpoint} with query ${query.toString()}`)
    return new Response("ACCESS DENIED", { status: 403 })
  }
  function notFound() {
    logErr(`Not found ${verb} ${endpoint} with query ${query.toString()}`)
    return new Response("NOT FOUND", { status: 404 })
  }
}

async function auth(query) {
  if (query.get("pass") === API_KEY) {
    return Promise.resolve()
  } else {
    return Promise.reject()
  }
}

function upgradeServer() {
  logOk("Upgrading the server...")
  return new Response("not yet implemented")
}

