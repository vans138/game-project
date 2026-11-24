为什么这样切（给未来改代码的人看）：

1) 界面只 import GameView 和 GameSource，绝不要直接 import 引擎内部（LocalGameSource 之外的东西）。
2) 想加界面元素 → 先加 GameView 字段（或先塞 extra），再在 LocalGameSource.getView 里填。
3) 想联网 → 新建 RemoteGameSource 实现同样的 3 个方法即可，界面零改动。
4) 引擎内部数据结构（RunState 等）随便改，只要 getView 输出不变，界面不受影响。