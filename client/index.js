// Simple export for SSR
export default {
  routes: [],
  create: (props) => props.children,
  context: Promise.resolve({}),
};