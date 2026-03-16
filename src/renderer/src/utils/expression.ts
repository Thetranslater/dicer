/**
 * 骰子表达式解析器
 *
 * 支持以下表达式格式：
 * - 1dY: 生成 1 个 1-Y 范围内的随机数（Y 可以是负数）
 * - 1d[X, Y]: 生成 1 个 X-Y 范围内的随机数（X < Y，X 和 Y 可以是负数）
 * - 四则运算: +, -, *, /
 * - 括号: ()
 *
 * 实现流程：
 * 1. 正则匹配：将表达式分割成操作数和操作符
 * 2. 中缀转后缀表达式
 * 3. 后缀表达式生成表达式树
 * 4. 递归计算表达式树得到结果
 */

/** 表达式节点类型 */
type NodeType = 'number' | 'dice' | 'binary'

/** 表达式节点 */
interface ASTNode {
  type: NodeType
  value?: number
  diceMin?: number
  diceMax?: number
  operator?: string
  left?: ASTNode
  right?: ASTNode
}

/** 表达式解析错误 */
export class ExpressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExpressionError'
  }
}

/**
 * 骰子表达式类
 * 将表达式字符串解析为表达式树并评估结果
 * 在实例中缓存解析结果，避免重复解析
 */
export class Expression {
  private tokens: string[] = []
  private postfixTokens: string[] = []
  private ast: ASTNode | null = null

  constructor(expression: string) {
    // 1. 正则匹配分割字符串
    this.tokens = this.tokenize(expression)
    // 2. 中缀转后缀表达式
    this.postfixTokens = this.infixToPostfix(this.tokens)
    // 3. 生成表达式树（缓存）
    this.ast = this.buildAST(this.postfixTokens)
  }

  private tokenize(expression: string): string[] {
    const tokens: string[] = []
    // 移除所有空格
    expression = expression.replace(/\s/g, '')

    const regex = /^-\d+|1d(-?\d+|\[-?\d+,-?\d+\])|[\+\-\*\/]|\d+|[()]/g

    let match: RegExpExecArray | null
    while ((match = regex.exec(expression)) !== null) {
      tokens.push(match[0])
    }

    // 检查是否有未匹配的字符
    const remaining = expression.replace(regex, '').trim()
    if (remaining.length > 0) {
      throw new ExpressionError(`无效的表达式: ${remaining}`)
    }

    return tokens
  }

  /**
   * 2. 中缀表达式转后缀表达式（使用栈实现）
   * 例如: ["(", "1d10", "+", "20", ")", "*", "5"] -> ["1d10", "20", "+", "5", "*"]
   */
  private infixToPostfix(tokens: string[]): string[] {
    const postfix: string[] = []
    const operatorStack: string[] = []
    // 运算符优先级
    const precedence: Record<string, number> = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2
    }

    for (const token of tokens) {
      // 数字、骰子或负数 -> 直接输出
      if (/^(\d+(?:\.\d+)?|1d(-?\d+|\[-?\d+,-?\d+\]))$/.test(token) || /^-\d+$/.test(token)) {
        postfix.push(token)
      }
      // 左括号 -> 入栈
      else if (token === '(') {
        operatorStack.push(token)
      }
      // 右括号 -> 弹出直到左括号
      else if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
          postfix.push(operatorStack.pop()!)
        }
        if (operatorStack.length === 0) {
          throw new ExpressionError('括号不匹配：缺少左括号')
        }
        operatorStack.pop() // 弹出左括号
      }
      // 运算符
      else if (['+', '-', '*', '/'].includes(token)) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== '(' &&
          precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
        ) {
          postfix.push(operatorStack.pop()!)
        }
        operatorStack.push(token)
      }
      else {
        throw new ExpressionError(`无效的 token: ${token}`)
      }
    }

    // 弹出所有剩余的运算符
    while (operatorStack.length > 0) {
      const op = operatorStack.pop()!
      if (op === '(') {
        throw new ExpressionError('括号不匹配：缺少右括号')
      }
      postfix.push(op)
    }

    return postfix
  }

  /**
   * 3. 通过后缀表达式生成表达式树
   * 例如: ["1d10", "20", "+", "5", "*"] -> 二叉树
   */
  private buildAST(postfixTokens: string[]): ASTNode {
    const stack: ASTNode[] = []

    for (const token of postfixTokens) {
      // 数字（包括负数）
      if (/^-?\d+(?:\.\d+)?$/.test(token)) {
        stack.push({
          type: 'number',
          value: parseFloat(token)
        })
      }
      // 骰子: 1dY 或 1d-30
      else if (/^1d-?\d+$/.test(token)) {
        const sides = parseInt(token.slice(2), 10)
        // 1dY: 生成 1-Y 范围内的随机数
        // 如果 Y 是负数，则生成 Y 到 -1 的随机数
        const min = sides > 0 ? 1 : sides
        const max = sides > 0 ? sides : -1
        stack.push({
          type: 'dice',
          diceMin: min,
          diceMax: max
        })
      }
      // 骰子: 1d[X, Y]
      else if (/^1d\[-?\d+,-?\d+\]$/.test(token)) {
        const match = token.match(/^1d\[(-?\d+),(-?\d+)\]$/)
        if (!match) {
          throw new ExpressionError(`无效的骰子表达式: ${token}`)
        }
        const min = parseInt(match[1], 10)
        const max = parseInt(match[2], 10)
        if (min >= max) {
          throw new ExpressionError(`范围骰子需要 min < max: ${token}`)
        }
        stack.push({
          type: 'dice',
          diceMin: min,
          diceMax: max
        })
      }
      // 运算符
      else if (['+', '-', '*', '/'].includes(token)) {
        if (stack.length < 2) {
          throw new ExpressionError(`表达式不完整，缺少操作数`)
        }
        const right = stack.pop()!
        const left = stack.pop()!
        stack.push({
          type: 'binary',
          operator: token,
          left,
          right
        })
      }
      else {
        throw new ExpressionError(`无效的 token: ${token}`)
      }
    }

    if (stack.length !== 1) {
      throw new ExpressionError('表达式格式错误')
    }

    return stack[0]
  }

  /**
   * 4. 评估表达式树（递归计算）
   */
  private evaluate(node: ASTNode): number {
    switch (node.type) {
      case 'number':
        return node.value!

      case 'dice': {
        // 生成 diceMin 到 diceMax 范围内的随机数
        const min = node.diceMin!
        const max = node.diceMax!
        return Math.floor(Math.random() * (max - min + 1)) + min
      }

      case 'binary': {
        const left = this.evaluate(node.left!)
        const right = this.evaluate(node.right!)
        switch (node.operator) {
          case '+':
            return left + right
          case '-':
            return left - right
          case '*':
            return left * right
          case '/':
            if (right === 0) {
              throw new ExpressionError('除数不能为零')
            }
            return Math.floor(left / right)
        }
      }
    }

    throw new ExpressionError('无效的节点类型')
  }

  /**
   * 解析并评估表达式，返回计算结果
   */
  evaluateExpression(): number {
    if (!this.ast) {
      throw new ExpressionError('表达式为空')
    }
    return this.evaluate(this.ast)
  }

  /**
   * 检查表达式是否有效
   */
  static isValid(expression: string): boolean {
    try {
      const expr = new Expression(expression)
      expr.evaluateExpression()
      return true
    } catch {
      return false
    }
  }

  /**
   * 解析表达式并返回结果详情
   */
  static parse(expression: string): { expression: string; result: number } {
    const expr = new Expression(expression)
    const result = expr.evaluateExpression()
    return { expression, result }
  }
}

/**
 * 生成带有实际结果的骰子文本
 * 例如: 输入 "1d10+20", 结果 25 返回 "1d10+20=25"
 */
export function generateDiceTextWithResult(expression: string, result: number): string {
  return `${expression}=${result}`
}
