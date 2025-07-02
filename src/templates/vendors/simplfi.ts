export function simplfiScript(id: string) {
  return {
    async: true,
    src: `https://tag.simpli.fi/sifitag/${id}`,
    element: "script",
  };
}
