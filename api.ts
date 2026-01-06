import qrcode from 'https://deno.land/x/qrcode_terminal/mod.js'

const API_KEY = crypto.randomUUID()
logOk(`Generated a key: ${API_KEY}`)
qrcode.generate(API_KEY)
console.log("\t\t   You can scan it, why not")
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

  if (verb === "GET" && endpoint === "/") {
    return redirectToRepo()
  } else if (verb === "GET" && endpoint === "/file") {
    return getFile(query)
  } else if (verb === "GET" && endpoint === "/upgrade") {
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

function redirectToRepo() {
  logOk("Redirecting to the repo")

  return new Response("Permanent Redirect", {
    status: 308,
    headers: {
      "Location": "https://github.com/snlxnet/api"
    }
  })
}

async function upgradeServer() {
  logOk("Upgrading the server...")

  const command = new Deno.Command("git", { args: ["pull"] });
  const { stdout, stderr } = await command.output();
  console.log(new TextDecoder().decode(stdout))
  console.error(new TextDecoder().decode(stderr))

  return new Response("done")
}

async function getFile(query) {
  const id = "./" + query.get("id").replace("/", "-")
  try {
    const file = await Deno.open(id, { read: true });
    logOk(`File sent ${id}`)
    return new Response(file.readable)
  } catch {
    logErr(`File not found ${id}`)
    return new Response("NOT FOUND", { status: 404 })
  }
}

