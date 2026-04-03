# GraphComponent

## 简介

在asset module中新增一个图组件用于描述资产之间的有向加权图关系。比如在某个恋爱故事中我们需要建立众多角色之间的好感度数值，这样的好感度网络正好可以使用有向加权图来表示。

## 功能

图组件包含一个自定义名称，创作者可通过名称来建立一个图，其他所有带有相同名称的图组件的资产共同组成一个有向加权图（这里仅用来说明图带有名称的意思，在实现中会具体描述）。图组件包含一个动态数组定义由该资产作为起点的加权边，创作者可以自主的加边、减边控制图的结构。创作者可以在边上使用随机数表达式生成权值。

## UI

图组件首先应该包含一个input元素来让用户确定名称，紧接着则是一个**可滚动的列表**（最多显示5个元素，即5条边）代表边集合，整个列表具有边框且在边框右上具有+按钮和-按钮用来加边和减边。每个边元素单独占据列表的一行，前方是一个可drop的长条区域，创作者可以拖动asset window上方的asset将其drop进该区域来确定边的终点，drop完毕后该区域仅显示asset的名称，在无目标时显示'---'。在可drop区域后边是一个可输入随机表达式的input和按钮，样式与RollableProperty一致。

## 实现

**由于边元素的UI将来是一个可复用的元素，请以EdgeProperty.vue来实现**。drop逻辑和随机表达式计算都在这其中。之后GraphComponent引用EdgeProperty继续实现。

---

新增主体文件：

- GraphComponent.vue

- EdgeProperty.vue

GraphComponent.vue至少包含的属性及功能（仅说明，具体实现和名称由你决定）

- name: string

- edges: EdgeProperty[]

    - add()

    - delete()

EdgeProperty.vue至少包含的属性和功能

- to: asset

- value: number

- dropping(asset)