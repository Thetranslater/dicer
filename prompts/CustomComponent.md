# CustomComponent

## 简介

接下来将开发一个用户可自定义的组件。用户将使用json格式描述其自定义组件内容。Dicer从程序目录的mods/components/{name}.ccomponent.json读取所有的用户自定义组件，这些组件可以在Inspector的添加组件功能中选中，以对asset添加自定义组件。

json代码示例：

``` json
{
    "name" : "TestComponent",
    "properties" : [
        {"name" : "a", "type" : "Rollable"},
        {"name" : "b", "type" : "Input"},
        {"name" : "c", "type" : "TextArea"},
        {"name" : "d", "type" : "Enum", "value": ["d1", "d2", "d3"]},
        {"name" : "e", "type" : "CheckBox"},
        {"name" : "f", "type" : "EdgeArray"},
    ]
}
```

## 功能

用户通过提前编写自定义组件的json代码来描述该自定义组件的名称和其拥有的属性。程序会读取json文件并定义好相应组件。之后用户可以像使用其他组件那样使用其自定义组件并保存到对应asset上。

## 实现

Asset Module会在初始化时读取程序所有的mods/components/{name}.ccomponent.json文件并暂时加载到内存中，同时在添加组件的列表中将所有自定义组件添加进去，自定义组件与预设组件之间使用分割线来划分。当用户添加自定义组件时，Asset Module在通过其名称通过工厂函数来创建对应组件并附着到asset上，其组件行为与其他预设组件一致，用户可改变可保存并可加载（即在读取asset时遇到自定义组件，Asset Module直接通过工厂函数创建）

**json文件描述**

- name：自定义组件的名称，当名称为空或无该字段时使用CustomComponent

- properties：组件属性数组，每个元素类型为`{name, type, value?}`

    - name：属性名

    - type: 属性类型

        - Rollable: 该属性是一个Rollable属性，使用RollableProperty.vue实现该属性

        - input：该属性是一个input属性，使用HTML的input元素实现该属性

        - TextArea：该属性是一个TextArea属性，允许用户多行输入，使用HTML的TextArea元素实现该属性

        - Enum： 该属性是一个枚举属性，此时属性元素中必须包含value属性，value是一个字符串数组，每个字符串对应一个枚举项。使用HTML selection实现。

        - CheckBox： 该属性是一个Check Box属性，实际是boolean值，使用HTML checkbox元素实现。

        - EdgeArray： 该属性是一个EdgeArray属性，仿照GraphComponent中的Edge数组，使用EdgeProperty.vue实现该属性。

除了Rollable，其余所有属性类型在UI中独占一行，Rollable使用grid布局，与其余component一致，两个占一行。

**新增文件**

新增utils/componentFactory.ts来实现工厂函数，该工厂函数不仅负责创建自定义组件，还负责预设的Character,Graph,Skill三种组件的创建。之后Asset Module使用该工厂函数创建对应组件。

新增CustomComponent.vue实现上述自定义组件的需求。