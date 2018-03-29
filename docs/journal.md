# ~~用 React 与 Redux-saga 实现坦克大战~~

_TODO 坦克大战介绍_

游戏主要包括几个方面的内容: 一素材 二数据与展现 三逻辑 四电脑玩家（AI-player）

## 一、素材

素材主要包括了以下各方面的内容:

1.  图片素材：例如坦克的形状/颜色, 各种地形的颜色/样子等
2.  关卡配置：每一关的战场地形配置，一关内会出现的敌对坦克的数量和等级；
3.  数值配置：例如子弹的速度，坦克的移动速度，道具铲子的持续时间等；
4.  游戏场景：游戏开始/结束场景，关卡结算场景等；
5.  音效（音效部分尚未完成）。

#### 图片素材

图片素材可以从网上下载得到， [该位图图片](/resources/General-Sprites.png) 中包含了坦克大战绝大部分的图片素材。因为复刻版使用矢量图来展现画面, 所以需要对位图进行矢量化处理。位图图片中的每个像素点, 都要转换为 SVG 中 1x1 的小矩形，这样整个游戏才会呈现像素风格。素材也可以适当地转换为 SVG 矩形元素或是 SVG 路径元素，以减少元素的数量，提升渲染性能。

大部分的素材，都是通过手工输入的方式得到的。例如坦克生成时的闪光效果，其颜色为白色，形状可认为是若干个矩形的叠加，我们使用若干个矩形元素就能表示闪光效果了。

对于一些比较复杂的素材，我们将其分解为若干个部分，对每个部分进行矢量化，然后组装起来得到整体素材。例如，_app/components/tanks.tsx_ 中将坦克分解为若干部分:

```
左侧的轮胎(left-tire)：
	轮胎的背景色
	轮胎上的花纹
右侧的轮胎(right-tire)：
	轮胎的背景色
	轮胎上的花纹
坦克主体(tank-body)：
	坦克主体的轮廓
	坦克主体上的装饰
坦克炮管(gun)：一个矩形
```

![素材分解](resource-decompose.jpg)

一些素材的形状具有一定的模式，此时可以采用循环/分支的方式来生成所需要的 SVG 元素。例如一个完整的砖墙的大小为 16x16，但是砖墙的左上/右上/左下/右下四个部分是完全一样的，有了砖墙左上部分(8x8)的 SVG 之后，使用循环可以生成整个砖墙。

一些素材的形状非常不规则，难以通过手工的方式进行输入，例如子弹/坦克的爆炸效果, 掉落道具的形状。我们使用脚本读取原始素材中每个像素点的颜色值，然后将其转换为一个字符，用于保存该点的颜色值。React 渲染时, 根据字符渲染出对应颜色的矩形(1x1)。该方式可以方便地对素材进行矢量化，但是会导致 React 组件数量大大增加，降低渲染效率。

素材矢量化的过程非常灵活，复刻版充分利用了循环/分支/组合简化了矢量化过程。[elements.tsx 文件](/app/components/elements.tsx)中的 `<Pixel />` 与 `<BitMap />` 组件在矢量化的过程中提供了很大的便利，可供参考。一项素材完成矢量化之后，可以将其放在 [Gallery 页面](http://shinima.pw/battle-city/#/gallery) 进行查看，和原始素材进行对比，方便改正其中的错误。

#### 关卡配置

[坦克大战 WIKI](https://strategywiki.org/wiki/Battle_City)上有完整的关卡配置表，根据配置表使用 [关卡编辑器](http://shinima.pw/battle-city/#/editor) 生成关卡配置 json 文件即可。

#### 数值配置

一部分数值配置比较明显，多玩几遍原版游戏就可以找到规律，例如玩家的坦克数量、坦克升级过程、不同类型坦克子弹效果、击毁不同类型坦克的得分等。其他数值配置的获取较为繁琐，例如子弹飞行速度、坦克移动速度、爆炸效果各帧的持续时间，这一部分大都从原版游戏录像中获取。[该文件](/docs/values.md) 中记录了一些我已经测量好的数值，可供参考。随着游戏的不断完善，该文件也会不断完善。

#### **游戏场景**

坦克大战中的不同场景的区分度很大，而同一场景的变化较小，对原版游戏中不同场景进行截图，复刻版根据这些截图进行开发即可。

#### 音效

音效部分尚未完成

## 二、数据与展现

~~*app/main.tsx* 是整个应用的入口, 而*app/App.tsx*是展现的入口. 从*app/App.tsx*文件中可以看到, 根据当前游戏状态的不同, 游戏会展现对应的场景. 游戏标题画面对应`<GameTitleScene />`; 游戏主画面对应`<GameScene />`; 游戏结束画面对应`<GameoverScene />`; 而每一个关卡结束时的统计画面对应`<StatisticScene />`. 游戏画面中还包括了一些其他辅助元素: `<CurtainsContainer />` / `<PauseIndicator />` / `<Inspector />` / `<HelpInfo />`~~  ~~TODO 其他的场景比较简单. 简单介绍一下`<GameScene />`~~

## 三、数据

该复刻版使用 redux 来管理数据，数据结构使用来自 Immutable.js 的 Map、List 等。reducer 层级整体较为扁平，不同方面的数据由各自的 reducer 进行维护，root reducer 将多个子reducer 合并起来。下面是整个游戏的数据结构，`time` 是整个游戏的时钟，`game` 记录了若干游戏状态（当前关卡名称、是否暂停、玩家的击杀统计等），`players` 记录了游戏中所有的玩家。除了上述三个字段，其他各个字段存放的数据都直接对应了**场景中出现的内容**，这点从字段名称中应该也能看出来。

```typescript
// 整个游戏的数据结构
interface State {
  time: number
  game: GameRecord
  players: PlayersMap
  // 以下每个字段都对应了「场景中显示的内容」
  bullets: BulletsMap
  explosions: ExplosionsMap
  map: MapRecord
  tanks: TanksMap
  flickers: FlickersMap
  texts: TextsMap
  powerUps: PowerUpsMap
  scores: ScoresMap
  // other reducers...
}
```

该复刻版使用 TypeScript 来进行开发，所有数据结构都有静态类型，在 VSCode 中将鼠标悬停在变量上方就可以直接看到变量的类型。

```typescript
// types/TankRecord.ts  坦克的数据结构
const TankRecordType = Record({
  active: true,
  tankId: 0,
  x: 0,
  y: 0,
  side: 'human' as Side,
  direction: 'up' as Direction,
  moving: false,
  level: 'basic' as TankLevel,
  color: 'auto' as TankColor,
  hp: 1,
  withPowerUp: false,

  // 该字段用来记录tank的helmet的剩余的持续时间
  helmetDuration: 0,
  // 该字段小于等于0表示可以进行移动, 大于0表示还需要等待x毫秒才能进行移动
  frozenTimeout: 0,
  // 该字段小于等于0表示可以进行开火, 大于0表示还需要等待x毫秒才能进行开火
  cooldown: 0,
})
```



## 四、逻辑

介绍游戏使用了哪些 saga; 不同的 saga 分别对应什么功能; 画出一棵"saga 树"

## 五 电脑玩家