function randomInt(min: number, max: number): number {
  const _min = Math.ceil(min)
  const _max = Math.floor(max)
  if (_min > _max) {
    throw new Error(`Invalid random range: [${_min}, ${_max}]`)
  }
  return Math.floor(Math.random() * (_max - _min + 1)) + _min
}

type Operator = '+' | '-' | '*' | '/'

const OP_PRECEDENCE: Record<Operator, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2
}

function isDigitChar(char: string): boolean {
  return char >= '0' && char <= '9'
}

function isOperatorToken(token: string): token is Operator {
  return token === '+' || token === '-' || token === '*' || token === '/'
}

abstract class Evaluable {
  abstract evaluate(): number
}

class EvaluateWrapper extends Evaluable {
  private value: number

  constructor(v: number) {
    super()
    this.value = v
  }

  evaluate(): number {
    return this.value
  }
}

class Dice extends Evaluable {
  private repeat: number
  private min: Evaluable
  private max: Evaluable

  constructor(repeat?: number, min?: Evaluable, max?: Evaluable) {
    super()
    this.repeat = repeat ?? 1
    this.min = min ?? new EvaluateWrapper(1)
    this.max = max ?? new EvaluateWrapper(10)
  }

  evaluate(): number {
    if (!Number.isInteger(this.repeat) || this.repeat <= 0) {
      throw new Error(`Invalid dice repeat count: ${this.repeat}`)
    }

    const evaluatedMin = Math.floor(this.min.evaluate())
    const evaluatedMax = Math.floor(this.max.evaluate())

    if (evaluatedMin > evaluatedMax) {
      throw new Error(`Dice range min cannot be greater than max: ${evaluatedMin} > ${evaluatedMax}`)
    }

    let result = 0
    for (let i = 0; i < this.repeat; i++) {
      result += randomInt(evaluatedMin, evaluatedMax)
    }
    return result
  }
}

class DNode extends Evaluable {
  private op: Evaluable | Operator
  private left: DNode | null
  private right: DNode | null

  constructor(op: Evaluable | Operator, l?: DNode, r?: DNode) {
    super()
    this.left = l ?? null
    this.right = r ?? null
    this.op = op
  }

  evaluate(): number {
    if (this.op instanceof Evaluable) return this.op.evaluate()

    if (!this.left || !this.right) {
      throw new Error(`Operator "${this.op}" is missing operands`)
    }

    const leftValue = this.left.evaluate()
    const rightValue = this.right.evaluate()

    switch (this.op) {
      case '+':
        return leftValue + rightValue
      case '-':
        return leftValue - rightValue
      case '*':
        return leftValue * rightValue
      case '/':
        if (rightValue === 0) {
          throw new Error('Division by zero')
        }
        return Math.floor(leftValue / rightValue)
    }
  }
}

export class Expression extends Evaluable {
  private root: DNode | null = null
  public expression: string

  constructor(exp: string) {
    super()
    this.expression = exp
    const tokens = this.tokenize()
    const rpn = this.toRPN(tokens)
    this.root = this.buildTree(rpn)
  }

  tokenize(): string[] {
    const expr = this.expression.replace(/\s+/g, '')
    if (!expr) {
      throw new Error('Expression is empty')
    }

    const tokens: string[] = []
    let index = 0
    let expectOperand = true

    while (index < expr.length) {
      const char = expr[index]

      if (char === '(') {
        if (!expectOperand) {
          throw new Error(`Missing operator before "(" at position ${index}`)
        }
        tokens.push(char)
        index += 1
        expectOperand = true
        continue
      }

      if (char === ')') {
        if (expectOperand) {
          throw new Error(`Unexpected ")" at position ${index}`)
        }
        tokens.push(char)
        index += 1
        expectOperand = false
        continue
      }

      if (isOperatorToken(char)) {
        if (char === '-' && expectOperand) {
          const next = expr[index + 1]

          if (next && isDigitChar(next)) {
            let end = index + 1
            while (end < expr.length && isDigitChar(expr[end])) {
              end += 1
            }

            if (end < expr.length && expr[end] === 'd') {
              tokens.push('0')
              tokens.push('-')
              index += 1
              expectOperand = true
              continue
            }

            tokens.push(expr.slice(index, end))
            index = end
            expectOperand = false
            continue
          }

          if (next === '(') {
            tokens.push('0')
            tokens.push('-')
            index += 1
            expectOperand = true
            continue
          }

          throw new Error(`Invalid unary minus at position ${index}`)
        }

        if (expectOperand) {
          throw new Error(`Unexpected operator "${char}" at position ${index}`)
        }

        tokens.push(char)
        index += 1
        expectOperand = true
        continue
      }

      if (isDigitChar(char)) {
        let end = index
        while (end < expr.length && isDigitChar(expr[end])) {
          end += 1
        }

        if (end < expr.length && expr[end] === 'd') {
          const [diceToken, nextIndex] = this.readDiceToken(expr, index, end)
          tokens.push(diceToken)
          index = nextIndex
        } else {
          tokens.push(expr.slice(index, end))
          index = end
        }

        expectOperand = false
        continue
      }

      throw new Error(`Invalid character "${char}" at position ${index}`)
    }

    if (expectOperand) {
      throw new Error('Expression cannot end with an operator')
    }

    return tokens
  }

  private readDiceToken(expression: string, start: number, repeatEnd: number): [string, number] {
    let index = repeatEnd + 1
    if (index >= expression.length) {
      throw new Error(`Dice expression is incomplete at position ${start}`)
    }

    if (expression[index] === '[') {
      let depth = 1
      index += 1
      while (index < expression.length && depth > 0) {
        const char = expression[index]
        if (char === '[') depth += 1
        if (char === ']') depth -= 1
        index += 1
      }

      if (depth !== 0) {
        throw new Error(`Dice range bracket is not closed at position ${start}`)
      }

      return [expression.slice(start, index), index]
    }

    if (expression[index] === '-') {
      index += 1
    }

    const boundStart = index
    while (index < expression.length && isDigitChar(expression[index])) {
      index += 1
    }

    if (boundStart === index) {
      throw new Error(`Dice bound is invalid at position ${start}`)
    }

    return [expression.slice(start, index), index]
  }

  private toRPN(tokens: string[]): Array<Evaluable | Operator> {
    const output: Array<Evaluable | Operator> = []
    const operatorStack: Array<Operator | '('> = []

    for (const token of tokens) {
      if (token === '(') {
        operatorStack.push(token)
        continue
      }

      if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
          output.push(operatorStack.pop() as Operator)
        }

        if (operatorStack.length === 0) {
          throw new Error('Mismatched parentheses: missing "("')
        }

        operatorStack.pop()
        continue
      }

      if (isOperatorToken(token)) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== '(' &&
          OP_PRECEDENCE[operatorStack[operatorStack.length - 1] as Operator] >= OP_PRECEDENCE[token]
        ) {
          output.push(operatorStack.pop() as Operator)
        }
        operatorStack.push(token)
        continue
      }

      output.push(this.parseOperand(token))
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop()
      if (op === '(') {
        throw new Error('Mismatched parentheses: missing ")"')
      }
      output.push(op as Operator)
    }

    return output
  }

  private parseOperand(token: string): Evaluable {
    if (/^-?\d+$/.test(token)) {
      return new EvaluateWrapper(parseInt(token, 10))
    }

    if (/^\d+d/.test(token)) {
      return this.parseDiceToken(token)
    }

    throw new Error(`Invalid operand token: ${token}`)
  }

  private parseDiceToken(token: string): Dice {
    const match = token.match(/^(\d+)d(.+)$/)
    if (!match) {
      throw new Error(`Invalid dice token: ${token}`)
    }

    const repeat = parseInt(match[1], 10)
    if (!Number.isInteger(repeat) || repeat <= 0) {
      throw new Error(`Invalid dice repeat count: ${match[1]}`)
    }

    const body = match[2]

    if (body.startsWith('[')) {
      if (!body.endsWith(']')) {
        throw new Error(`Dice range is invalid: ${token}`)
      }

      const rangeBody = body.slice(1, -1)
      const [minExpr, maxExpr] = this.splitTopLevelRange(rangeBody)

      const min = this.parseDiceBoundExpression(minExpr)
      const max = this.parseDiceBoundExpression(maxExpr)

      return new Dice(repeat, min, max)
    }

    if (!/^-?\d+$/.test(body)) {
      throw new Error(`Dice bound must be an integer: ${token}`)
    }

    const bound = parseInt(body, 10)
    if (bound >= 0) {
      return new Dice(repeat, new EvaluateWrapper(1), new EvaluateWrapper(bound))
    }

    return new Dice(repeat, new EvaluateWrapper(bound), new EvaluateWrapper(-1))
  }

  private parseDiceBoundExpression(raw: string): Evaluable {
    if (/^-?\d+$/.test(raw)) {
      return new EvaluateWrapper(parseInt(raw, 10))
    }
    return new Expression(raw)
  }

  private splitTopLevelRange(rangeText: string): [string, string] {
    let commaIndex = -1
    let parenthesisDepth = 0
    let bracketDepth = 0

    for (let i = 0; i < rangeText.length; i++) {
      const char = rangeText[i]

      if (char === '(') parenthesisDepth += 1
      else if (char === ')') parenthesisDepth -= 1
      else if (char === '[') bracketDepth += 1
      else if (char === ']') bracketDepth -= 1
      else if (char === ',' && parenthesisDepth === 0 && bracketDepth === 0) {
        if (commaIndex !== -1) {
          throw new Error(`Dice range has too many separators: [${rangeText}]`)
        }
        commaIndex = i
      }

      if (parenthesisDepth < 0 || bracketDepth < 0) {
        throw new Error(`Dice range expression is malformed: [${rangeText}]`)
      }
    }

    if (parenthesisDepth !== 0 || bracketDepth !== 0 || commaIndex === -1) {
      throw new Error(`Dice range must be [min,max]: [${rangeText}]`)
    }

    const left = rangeText.slice(0, commaIndex).trim()
    const right = rangeText.slice(commaIndex + 1).trim()

    if (!left || !right) {
      throw new Error(`Dice range min/max cannot be empty: [${rangeText}]`)
    }

    return [left, right]
  }

  private buildTree(rpn: Array<Evaluable | Operator>): DNode {
    const stack: DNode[] = []

    for (const token of rpn) {
      if (typeof token !== 'string') {
        stack.push(new DNode(token))
        continue
      }

      if (stack.length < 2) {
        throw new Error(`Operator "${token}" is missing operands`)
      }

      const right = stack.pop() as DNode
      const left = stack.pop() as DNode
      stack.push(new DNode(token, left, right))
    }

    if (stack.length !== 1) {
      throw new Error('Expression tree build failed')
    }

    return stack[0]
  }

  evaluate(): number {
    if (!this.root) {
      throw new Error('Expression root is empty')
    }
    return this.root.evaluate()
  }

  static isValid(expression: string): boolean {
    try {
      const expr = new Expression(expression)
      expr.evaluate()
      return true
    } catch {
      return false
    }
  }
}
