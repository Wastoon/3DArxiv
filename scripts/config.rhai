/* --- MyArxiv Config for 3D Vision, Robotics & Autonomous Driving --- */
/* Enhanced version with expanded keywords for your research areas */

/* --- DATA SECTION --- */

/* 论文类型 */
let titles_type = [
    "Dataset", "Survey", "Review", "Overview", "World Model", 
    "Video World Model", "Predictive World Model", "Foundation Model", 
    "Benchmark", "Benchmark Suite", "Analysis", "Evaluation", 
    "Theoretical", "Empirical"
];

/* 模型和方法 - 3D视觉、机器人、自动驾驶 */
let titles_model = [
    // 3D 视觉核心
    "SLAM", "Visual SLAM", "vSLAM", "monocular SLAM", "stereo SLAM", "RGB-D SLAM",
    "Structure from Motion", "SfM",
    "NeRF", "Neural Radiance Field", "3D Gaussian Splatting", "Gaussian Splatting",
    
    // 生成和预测
    "Diffusion", "Transformer", "Vision Transformer", "ViT",
    "Sora", "Video Diffusion",
    
    // 自动驾驶和感知
    "BEV", "Bird's Eye View", "Occupancy", "Occupancy Grid",
    "3D Object Detection", "3D Detection",
    
    // 机器人相关
    "VLA", "Vision-Language-Action", "Vision-Language Model",
    "JEPA", "Joint Embedding Predictive Architecture",
    "Dreamer", "World Models",
    
    // 其他核心方法
    "UniAD", "Video Generation", "Scene Understanding",
    "3D Reconstruction", "Multi-view", "Monocular", "Stereo",
    "Point Cloud", "Voxel", "Mesh", "Neural Field",
    "FieldCompression"
];

/* 技术方法论 */
let titles_method = [
    // 学习范式
    "End-to-End", "Self-Supervised", "Unsupervised", "Supervised",
    "Reinforcement", "Reinforcement Learning", "RL",
    "Imitation Learning", "Learning from Demonstration",
    
    // 机器人控制和学习
    "Manipulation", "Dexterous", "Humanoid", "Robot Learning",
    "Behavioral Cloning", "Inverse Reinforcement Learning", "IRL",
    
    // 模拟和现实
    "Sim-to-Real", "Real-to-Sim", "Domain Randomization",
    "embodied", "embodied AI", "embodied learning",
    "world model", "world models", "prediction", "predictive model",
    
    // 运动规划和控制
    "trajectory", "trajectory planning", "motion planning", "path planning",
    "control", "MPC", "Model Predictive Control",
    "decision making", "policy", "policy learning",
    "simulation", "simulator", "closed-loop", "interactive",
    
    // 场景理解
    "lane", "lane detection", "road", "road segmentation",
    "urban", "urban scene", "scene understanding", "scene graph",
    "semantic segmentation", "instance segmentation", "panoptic segmentation",
    
    // 多模态和少样本
    "multi-modal", "multimodal", "cross-modal",
    "zero-shot", "few-shot", "zero-shot learning", "few-shot learning",
    
    // 导航和定位
    "navigation", "autonomous navigation", "indoor navigation",
    "localization", "mapping", "LOAM",
    "grasp", "grasping", "grasp planning", "grasp synthesis",
    
    // 3D 表示
    "field", "neural field", "implicit field",
    "nerf", "voxel", "point cloud", "surface", "mesh",
    "3D representation", "3D understanding",
    
    // 传感器融合
    "lidar", "LiDAR", "radar", "camera", "RGB-D",
    "sensor fusion", "multi-sensor", "sensor calibration",
    "calibration", "camera calibration", "intrinsics", "extrinsics",
    
    // 其他重要方法
    "optical flow", "depth estimation", "dense prediction",
    "correspondence", "feature matching", "descriptor",
    "bundle adjustment", "pose estimation", "pose tracking",
    "loop closure", "place recognition",
    "uncertainty", "uncertainty estimation", "confidence"
];

/* 顶级研究者 - 3D视觉、机器人、自动驾驶领域 */
let authors_array = [
    // SLAM 和3D视觉先驱
    "Shaojie Shen", "Luca Carlone", "Frank Dellaert", 
    "Davide Scaramuzza", "Marc Pollefeys", "Andrew Davison", 
    "Daniel Cremers", "Cyrill Stachniss",
    
    // 机器人学和控制
    "Yoshua Bengio", "Heng Yang", "Fei Gao", "Fu Zhang", 
    "Yue Wang", "Hang Zhao", "Kaiming He",
    
    // 自动驾驶和规划
    "Jonathan P. How", "Marco Pavone", "Raquel Urtasun",
    "Sanja Fidler", "Andreas Geiger",
    
    // 机器学习和强化学习
    "Sergey Levine", "Chelsea Finn", "Jitendra Malik",
    
    // 世界模型和预测
    "Danijar Hafner", "David Ha", "Yann LeCun",
    
    // 其他重要研究者
    "Timothy D. Barfoot", "Kasra Khosoussi",
    "Shoudong Huang", "Guoquan Huang",
    "Guofeng Zhang", "Javier Civera", "Jose Luis Blanco Claraco",
    "Philipp Krähenbühl", "Abhinav Gupta", "Animesh Garg",
    "Wolfram Burgard", "Yann LeCun",
    
    // 新一代研究者
    "Dian Chen", "Yilun Du", "Igor Mordatch",
    "Aravind Srinivas", "Hongsheng Li", "Xiaogang Wang",
    "Thomas Funkhouser", "Leonidas Guibas"
];

/* 顶级会议和期刊 - 机器人、视觉、自动驾驶 */
let conferences = [
    // 机器人和自动驾驶顶会
    "ICRA", "IROS", "RSS", "CORL", "IJRR", "RA-L", "RAL", "RAM",
    "TRO", "T-RO", "JFR", "L4DC",
    
    // 自动驾驶相关
    "IV", "ITSC", "T-ITS", "TITS", "CoRL",
    
    // AI 和 ML 顶会
    "NeurIPS", "NIPS", "ICLR", "ICML", "AAAI", "IJCAI", "AISTATS", "UAI",
    
    // 计算机视觉顶会
    "CVPR", "ICCV", "ECCV", "3DV", "WACV", "BMVC",
    "3D Vision", "3D Vision Workshop",
    
    // 高影响力期刊
    "Science Robotics", "Nature Machine Intelligence",
    "IEEE TPAMI", "PAMI", "TIP", "IJCV",
    "IEEE Transactions on Robotics", "IEEE Transactions on Pattern Analysis",
    
    // 控制和系统
    "CDC", "ACC", "T-CST", "TMECH", "TASE", "RAS",
    
    // 其他重要会议
    "CVPR Workshop", "ICCV Workshop", "ECCV Workshop",
    "Embodied AI Workshop", "3D Understanding Workshop"
];

/* 顶级机构 */
let top_labs = [
    // 工业界
    "NVIDIA", "DeepMind", "OpenAI", "Google Research", "Google AI",
    "Meta AI", "Tesla AI", "Waymo", "Cruise", "Zoox",
    
    // 学术界 - 美国
    "Stanford", "MIT", "Berkeley", "CMU", "Princeton", "Yale",
    "University of Pennsylvania", "UC San Diego", "Caltech",
    
    // 学术界 - 国际
    "ETH Zurich", "Oxford", "Cambridge", "Imperial College",
    "University of Tokyo", "NUS", "HKU", "HKUST",
    
    // 其他重要机构
    "Max Planck Institute", "INRIA", "University of Bonn",
    "UC Berkeley", "Carnegie Mellon", "University of Toronto"
];

/* --- LOGIC SECTION --- */

/* 合并所有标题关键词 */
let titles = titles_model + titles_method + titles_type;

/* 构建正则表达式 */
let start = conferences.shift();
let conferences_rg = conferences.reduce(|sum, v| sum + "|" + v, start);
let conferences_rg = "(" + conferences_rg + ")([\\s'-]*\\d+)?";

let start = titles.shift();
let title_rg = titles.reduce(|sum, v| sum + "|" + v, start);

let start = authors_array.shift();
let authors_rg = authors_array.reduce(|sum, v| sum + "|" + v, start);

let start = top_labs.shift();
let labs_rg = top_labs.reduce(|sum, v| sum + "|" + v, start);

/* 导出正则表达式供其他脚本使用 */
export title_rg;
export authors_rg;
export conferences_rg;
export labs_rg;
export titles;
export authors_array;
export conferences;
export top_labs;
