import { writeFileSync } from "fs";
import { cpus } from "os";

const cores = cpus().length;
const requested = Number.parseInt(process.env.NX_PARALLEL ?? "", 10);
const parallel = Number.isFinite(requested)
  ? Math.max(1, requested)
  : Math.max(2, Math.min(cores, 12));

writeFileSync(".local.env", `NX_PARALLEL=${parallel}\n`);
