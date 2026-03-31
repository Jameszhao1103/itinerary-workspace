import { createAppServer } from "./create-server.mjs";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const { server } = await createAppServer();

server.listen(port, () => {
  console.log(`Planner workspace running at http://localhost:${port}`);
});
