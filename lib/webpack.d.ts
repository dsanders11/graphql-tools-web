/// <reference types="node" />
import { loader } from 'webpack';
export default function graphQLLoader(this: loader.LoaderContext, source: string | Buffer): Promise<void>;
