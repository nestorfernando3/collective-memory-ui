function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function readEndpointId(endpoint) {
  if (!endpoint || typeof endpoint !== 'object') return '';

  return firstDefinedString(
    endpoint.id,
    endpoint.projectId,
    endpoint.project_id,
    endpoint.from,
    endpoint.to,
    endpoint.source,
    endpoint.target,
    endpoint.value,
  );
}

export function resolveConnectionEndpointIds(connection = {}) {
  const source = firstDefinedString(
    connection.from,
    connection.source,
    connection.sourceId,
    connection.source_id,
    readEndpointId(connection.sourceProject),
    readEndpointId(connection.sourceProjectId),
    readEndpointId(connection.sourceEndpoint),
  );

  const target = firstDefinedString(
    connection.to,
    connection.target,
    connection.targetId,
    connection.target_id,
    readEndpointId(connection.targetProject),
    readEndpointId(connection.targetProjectId),
    readEndpointId(connection.targetEndpoint),
  );

  return {
    source,
    target,
  };
}
