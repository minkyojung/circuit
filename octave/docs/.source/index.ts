// @ts-nocheck -- skip type checking
import * as d_docs_3 from "../content/docs/getting-started/quickstart.mdx?collection=docs"
import * as d_docs_2 from "../content/docs/getting-started/installation.mdx?collection=docs"
import * as d_docs_1 from "../content/docs/test-page.mdx?collection=docs"
import * as d_docs_0 from "../content/docs/index.mdx?collection=docs"
import { _runtime } from "fumadocs-mdx/runtime/next"
import * as _source from "../source.config"
export const docs = _runtime.docs<typeof _source.docs>([{ info: {"path":"index.mdx","fullPath":"content/docs/index.mdx"}, data: d_docs_0 }, { info: {"path":"test-page.mdx","fullPath":"content/docs/test-page.mdx"}, data: d_docs_1 }, { info: {"path":"getting-started/installation.mdx","fullPath":"content/docs/getting-started/installation.mdx"}, data: d_docs_2 }, { info: {"path":"getting-started/quickstart.mdx","fullPath":"content/docs/getting-started/quickstart.mdx"}, data: d_docs_3 }], [{"info":{"path":"meta.json","fullPath":"content/docs/meta.json"},"data":{"title":"Documentation","pages":["index","test-page","---Getting Started---","getting-started/installation","getting-started/quickstart"]}}])