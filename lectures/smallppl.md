
This is a brief documentation of a very small probabilistic programming language, called SmallPPL (pronounced 'small people').

# The language

## The deterministic part

~~~~
 
~~~~


Program, BlockStatement, ExpressionStatement, IfStatement, ReturnStatement, 
VariableDeclaration

FunctionExpression

Programs consist of a block of statements

 
#

## A grammar of SmallPPL

first the wrapper statements (which we can pretty much ignore for pedagogical purposes): Program, BlockStatement, ExpressionStatement, ReturnStatement
        next the basic statements where nothing fancy happens: VariableDeclaration, CallExpression, Identifier, Literal
        we need some branching operator: ConditionalExpression  or  IfStatement
        we have to choose whether to make this turing complete via first class functions or while loops: WhileStatement  or  FunctionExpression
        and then i think we should explicitly mark ERP applications to make life simple: SampleStatement
        maybe also make queries a special case: QueryStatement, ConditionStatement, and maybe: FactorStatement
