import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ChevronRight, Clock, Loader2 } from 'lucide-react';
import type { Project, ProjectDifficulty } from '@/types/project';
import type { User } from '@/types';
import { getDifficultyLevel } from '@/types/project';
import { projectApi, tagApi, type Tag } from '@/services/project';
import { getImageUrl } from '@/config';

interface ProjectListProps {
  onProjectSelect: (project: Project) => void;
  currentUser: User | null;
  onLoginRequired: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onProjectSelect, currentUser, onLoginRequired }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 加载项目列表
  const loadProjects = async (keyword?: string, tagId?: number) => {
    setLoading(true);
    try {
      const result = await projectApi.getList({
        page: 1,
        pageSize: 20,
        status: 1, // 只显示已发布的项目
        keyword: keyword || undefined,
        tagId: tagId || undefined,
      });
      if (result.success && result.data) {
        setProjects(result.data.list as Project[]);
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载标签列表
  const loadTags = async () => {
    try {
      const result = await tagApi.getAll();
      if (result.success && result.data) {
        setTags(result.data);
      }
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  };

  useEffect(() => {
    loadProjects();
    loadTags();
  }, []);

  // 搜索
  const handleSearch = () => {
    loadProjects(searchQuery, activeFilter || undefined);
  };

  // 标签筛选
  const handleFilterChange = (tagId: number | null) => {
    setActiveFilter(tagId);
    loadProjects(searchQuery, tagId || undefined);
  };

  // 计算预估时长
  const getEstimatedDuration = (labsCount: number, challengesCount: number): string => {
    const totalMinutes = (labsCount || 0) * 15 + (challengesCount || 0) * 30;
    if (totalMinutes < 60) return `${totalMinutes || 30} 分钟`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
  };

  // 获取难度标签样式
  const getLevelBadgeStyle = (level: ProjectDifficulty) => {
    switch (level) {
      case 'Beginner':
        return 'bg-emerald-500/80 text-white border-emerald-400/50';
      case 'Intermediate':
        return 'bg-blue-500/80 text-white border-blue-400/50';
      case 'Advanced':
        return 'bg-amber-500/80 text-white border-amber-400/50';
    }
  };

  // 获取难度中文名
  const getLevelName = (level: ProjectDifficulty) => {
    switch (level) {
      case 'Beginner': return '初级';
      case 'Intermediate': return '中级';
      case 'Advanced': return '高级';
    }
  };

  return (
    <div className="w-full min-h-screen pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
          在线构建
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-600 ml-3">
            真实项目
          </span>
        </h1>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto relative group z-20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-300 to-secondary-300 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
          <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-lg shadow-primary-500/10 hover:shadow-xl hover:shadow-primary-500/20 transition-all overflow-hidden group-focus-within:border-primary-400 group-focus-within:shadow-xl group-focus-within:shadow-primary-500/30">
            <Search className="w-5 h-5 text-slate-400 ml-5" />
            <input
              type="text"
              placeholder="搜索感兴趣的项目、技术栈..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 py-3.5 px-4 bg-transparent outline-none text-slate-700 placeholder-slate-400 text-sm"
            />
            <button 
              onClick={handleSearch}
              className="mr-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-bold hover:from-primary-700 hover:to-primary-800 transition-all hover:shadow-lg hover:shadow-primary-600/30 active:scale-95"
            >
              搜索
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filter Tags */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap justify-center gap-3 mb-12"
      >
        <div className="flex items-center mr-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
          <Filter className="w-4 h-4 mr-2" />
          标签:
        </div>
        <button
          onClick={() => handleFilterChange(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
            activeFilter === null
              ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20 scale-105'
              : 'bg-white/50 border-white/60 text-slate-500 hover:bg-white hover:border-slate-200 hover:text-slate-700'
          }`}
        >
          全部
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleFilterChange(tag.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
              activeFilter === tag.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20 scale-105'
                : 'bg-white/50 border-white/60 text-slate-500 hover:bg-white hover:border-slate-200 hover:text-slate-700'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <span className="ml-3 text-slate-500">加载中...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">暂无项目</h3>
          <p className="text-slate-500">还没有发布的项目，请稍后再来看看</p>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, i) => {
            const level = getDifficultyLevel(project.difficulty);
            const duration = getEstimatedDuration(project.labsCount, project.challengesCount);

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => onProjectSelect(project)}
                className="group relative cursor-pointer bg-white rounded-3xl border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden"
              >
                {/* Cover Image */}
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={getImageUrl(project.coverUrl)}
                    alt={project.title}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-60"></div>

                  {/* Level Badge */}
                  <div className="absolute top-4 right-4">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${getLevelBadgeStyle(level)}`}
                    >
                      {getLevelName(level)}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-primary-600 transition-colors line-clamp-1">
                    {project.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-2 flex-grow">
                    {project.subtitle || project.description || '暂无简介'}
                  </p>

                  {/* Footer Info */}
                  <div className="pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <div className="flex gap-4">
                      {project.tags && project.tags[0] && (
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50">
                          <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: project.tags[0].styleColor || '#94a3b8' }}
                          ></span>
                          {project.tags[0].name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {duration}
                      </span>
                    </div>
                    <div className="flex items-center text-primary-600 font-bold opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      <span className="mr-1">开始</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
