/**
 * Prompt templates for codebuddy -p headless probes.
 * Each prompt asks the model to self-report in structured JSON.
 */

export const MCP_LIST_PROMPT = `请列出当前会话所有已启用的 MCP 服务器。对每个服务器输出 JSON 数组，每项含 name、status(enabled/disabled)、toolsCount(数字或null)、source(user/project)。仅返回 JSON 数组，不要其他文字。`

export const SKILL_LIST_PROMPT = `请列出当前 CodeBuddy 会话中已加载到上下文的 Skills。注意：只列出已被系统实际加载、出现在 <available_skills> 列表中的 Skill，不要列出未启用或已安装但未加载的 Skill。对每个 skill 输出 JSON 数组，每项含 name、source(user/project/plugin)、description。仅返回 JSON 数组，不要其他文字。`

export const CONTEXT_USAGE_PROMPT = `请列出当前会话的上下文占用情况。按照 System prompt / System tools / Memory files / Messages / Skills 分类，给出每个分类的估算 token 数。仅返回 JSON 对象，不要其他文字。`

export const TOOL_LIST_PROMPT = `请列出当前会话所有可用的工具名称（内置工具 + MCP 工具）。仅返回工具名的 JSON 字符串数组，不要其他文字。`

export const MCP_LIST_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      status: { type: 'string', enum: ['enabled', 'disabled'] },
      toolsCount: { type: ['number', 'null'] },
      source: { type: 'string', enum: ['user', 'project'] },
    },
    required: ['name', 'status', 'toolsCount', 'source'],
  },
}

export const SKILL_LIST_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      source: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name', 'source', 'description'],
  },
}

export const TOOL_LIST_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
}
