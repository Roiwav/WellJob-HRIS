const API_CONFIG_PATTERN =
  /\/src\/config\/api(?:\.js)?$/;

export async function resolve(
  specifier,
  context,
  nextResolve
) {
  if (
    [
      "../config/api",
      "../../config/api",
    ].includes(
      specifier
    ) ||
    API_CONFIG_PATTERN.test(
      specifier
    )
  ) {
    return {
      url:
        "data:text/javascript," +
        encodeURIComponent(
          'export const API_BASE = "http://test.invalid/api";'
        ),
      shortCircuit: true,
    };
  }

  try {
    return await nextResolve(
      specifier,
      context
    );
  } catch (error) {
    const isRelative =
      specifier.startsWith("./") ||
      specifier.startsWith("../");

    const hasExtension =
      /\.[a-z0-9]+$/i.test(
        specifier
      );

    if (
      error?.code !==
        "ERR_MODULE_NOT_FOUND" ||
      !isRelative ||
      hasExtension
    ) {
      throw error;
    }

    return nextResolve(
      `${specifier}.js`,
      context
    );
  }
}
